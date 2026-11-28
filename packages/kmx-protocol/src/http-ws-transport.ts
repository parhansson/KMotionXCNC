import { decodeStatusBinary, decodeTextMessage, encodeCallbackAck } from './decoder';
import type { StatusWorkerRequest, StatusWorkerResponse } from './status.worker';
import type { FileStorage, KmxTransport } from './transport';
import type {
  BackendCapabilities,
  ConnectionState,
  ControlMessage,
  DirEntry,
  DirListing,
  KmxRpcResponse,
  KmxStatus,
  RawLogEntry,
} from './types';

export interface HttpWsTransportOptions {
  /** Base HTTP/HTTPS URL of the kmxWeb backend. Defaults to same-origin in browsers. */
  baseUrl?: string;
  /** Optional bearer token for LAN-authenticated sessions. */
  authToken?: string;
  /** Decode binary WebSocket status frames in a Web Worker when available (default: true). */
  useWorker?: boolean;
  /** Initial reconnect delay in milliseconds (default: 1000). */
  reconnectDelayMs?: number;
  /** Maximum reconnect backoff delay in milliseconds (default: 15000). */
  maxReconnectDelayMs?: number;
  /** Injectable fetch implementation for testing or custom runtimes. */
  fetchImpl?: typeof fetch;
  /** Injectable WebSocket constructor for testing or Node runtimes. */
  WebSocketImpl?: typeof WebSocket;
}

export function normalizeBaseUrl(baseUrl?: string): string {
  if (baseUrl && baseUrl.trim().length > 0) {
    return baseUrl.trim().replace(/\/+$/, '');
  }
  if (typeof globalThis.location !== 'undefined' && globalThis.location.origin) {
    return globalThis.location.origin.replace(/\/+$/, '');
  }
  return '';
}

export function toWebSocketUrl(baseUrl: string): string {
  const normalized = normalizeBaseUrl(baseUrl);
  if (normalized.startsWith('https://')) {
    return `wss://${normalized.slice('https://'.length)}/ws`;
  }
  if (normalized.startsWith('http://')) {
    return `ws://${normalized.slice('http://'.length)}/ws`;
  }
  if (normalized.startsWith('wss://') || normalized.startsWith('ws://')) {
    return normalized.endsWith('/ws') ? normalized : `${normalized}/ws`;
  }
  return '/ws';
}

const DEFAULT_LEGACY_CAPABILITIES: BackendCapabilities = {
  apiVersion: 0,
  offline: false,
  maxAxes: 6,
  features: {
    capabilities: false,
    deadmanJog: false,
    mdi: false,
    fixtures: false,
  },
};

export class HttpWsTransport implements KmxTransport {
  readonly kind = 'http-ws' as const;

  private readonly baseUrl: string;
  private authToken: string | undefined;
  private readonly useWorker: boolean;
  private readonly reconnectDelayMs: number;
  private readonly maxReconnectDelayMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly WebSocketImpl: typeof WebSocket | undefined;

  private ws: WebSocket | null = null;
  private worker: Worker | null = null;
  private state: ConnectionState = 'disconnected';
  private intentionalDisconnect = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private capabilities: BackendCapabilities | null = null;

  private readonly statusListeners = new Set<(status: KmxStatus) => void>();
  private readonly messageListeners = new Set<(message: ControlMessage) => void>();
  private readonly stateListeners = new Set<(state: ConnectionState, error?: string) => void>();
  private readonly rawLogListeners = new Set<(entry: RawLogEntry) => void>();

  constructor(options: HttpWsTransportOptions = {}) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.authToken = options.authToken;
    this.useWorker = options.useWorker ?? true;
    this.reconnectDelayMs = options.reconnectDelayMs ?? 1000;
    this.maxReconnectDelayMs = options.maxReconnectDelayMs ?? 15000;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.WebSocketImpl =
      options.WebSocketImpl ?? (typeof WebSocket !== 'undefined' ? WebSocket : undefined);
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  setAuthToken(token: string | undefined): void {
    this.authToken = token;
  }

  getConnectionState(): ConnectionState {
    return this.state;
  }

  private setState(state: ConnectionState, error?: string): void {
    this.state = state;
    for (const listener of this.stateListeners) {
      listener(state, error);
    }
  }

  private emitRawLog(direction: RawLogEntry['direction'], message: string): void {
    const entry: RawLogEntry = {
      timestamp: Date.now(),
      direction,
      message,
    };
    for (const listener of this.rawLogListeners) {
      listener(entry);
    }
  }

  private buildHeaders(extra?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = { ...extra };
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }
    return headers;
  }

  async getCapabilities(): Promise<BackendCapabilities> {
    const headers = this.buildHeaders({ Accept: 'application/json' });
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/api/kmx/capabilities`, {
        method: 'GET',
        headers,
      });
      if (res.ok) {
        const parsed = (await res.json()) as Partial<BackendCapabilities>;
        this.capabilities = {
          apiVersion: parsed.apiVersion ?? 1,
          offline: Boolean(parsed.offline),
          maxAxes: parsed.maxAxes ?? 8,
          jogHeartbeatMs: parsed.jogHeartbeatMs,
          features: parsed.features ?? { capabilities: true },
        };
        return this.capabilities;
      }
    } catch {
      // Fallback to POST /api/kmx/onGetCapabilities below
    }

    try {
      const res = await this.fetchImpl(`${this.baseUrl}/api/kmx/onGetCapabilities`, {
        method: 'POST',
        headers: this.buildHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ params: null }),
      });
      if (res.ok) {
        const parsed = (await res.json()) as Partial<BackendCapabilities>;
        if (typeof parsed.apiVersion === 'number') {
          this.capabilities = {
            apiVersion: parsed.apiVersion,
            offline: Boolean(parsed.offline),
            maxAxes: parsed.maxAxes ?? 8,
            jogHeartbeatMs: parsed.jogHeartbeatMs,
            features: parsed.features ?? { capabilities: true },
          };
          return this.capabilities;
        }
      }
    } catch {
      // Legacy kmxWeb without capabilities endpoint
    }

    this.capabilities = { ...DEFAULT_LEGACY_CAPABILITIES };
    return this.capabilities;
  }

  private initWorkerIfAvailable(): void {
    if (!this.useWorker || this.worker || typeof Worker === 'undefined') {
      return;
    }
    try {
      const worker = new Worker(new URL('./status.worker.ts', import.meta.url), {
        type: 'module',
      });
      worker.onmessage = (event: MessageEvent<StatusWorkerResponse>) => {
        const data = event.data;
        if (data.kind === 'status') {
          for (const listener of this.statusListeners) {
            listener(data.status);
          }
        } else if (data.kind === 'decoded') {
          this.handleDecodedText(data.decoded);
        } else if (data.kind === 'error') {
          this.emitRawLog('error', `Worker decode error: ${data.error}`);
        }
      };
      worker.onerror = () => {
        worker.terminate();
        this.worker = null;
      };
      this.worker = worker;
    } catch {
      this.worker = null;
    }
  }

  private handleDecodedText(decoded: ReturnType<typeof decodeTextMessage>): void {
    if (decoded.kind === 'hello') {
      this.emitRawLog('info', `Handshake: ${decoded.message}`);
    } else if (decoded.kind === 'control') {
      for (const listener of this.messageListeners) {
        listener(decoded.message);
      }
    } else {
      this.emitRawLog('in', decoded.raw);
    }
  }

  async connect(): Promise<void> {
    this.intentionalDisconnect = false;
    this.clearReconnectTimer();
    this.setState('connecting');

    // Capability probe before opening WebSocket
    try {
      const caps = await this.getCapabilities();
      this.emitRawLog(
        'info',
        `Capabilities: apiVersion=${caps.apiVersion}, maxAxes=${caps.maxAxes}, offline=${caps.offline}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.emitRawLog('error', `Capability check failed: ${msg}`);
    }

    if (!this.WebSocketImpl) {
      this.setState('error', 'WebSocket is not available in this environment');
      throw new Error('WebSocket is not available in this environment');
    }

    this.initWorkerIfAvailable();
    await this.openSocket();
  }

  private openSocket(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.WebSocketImpl) {
        reject(new Error('WebSocket unavailable'));
        return;
      }

      const wsUrl = toWebSocketUrl(this.baseUrl);
      this.emitRawLog('info', `Connecting WebSocket: ${wsUrl}`);

      let settled = false;
      const ws = new this.WebSocketImpl(wsUrl);
      ws.binaryType = 'arraybuffer';
      this.ws = ws;

      ws.onopen = () => {
        this.reconnectAttempt = 0;
        this.setState('connected');
        this.emitRawLog('info', `WebSocket connected: ${wsUrl}`);
        if (!settled) {
          settled = true;
          resolve();
        }
      };

      ws.onmessage = (event: MessageEvent) => {
        const offline = this.capabilities?.offline ?? false;
        if (typeof event.data === 'string') {
          this.emitRawLog('in', event.data);
          if (this.worker) {
            const req: StatusWorkerRequest = { kind: 'text', text: event.data };
            this.worker.postMessage(req);
          } else {
            this.handleDecodedText(decodeTextMessage(event.data));
          }
        } else if (event.data instanceof ArrayBuffer) {
          if (this.worker) {
            const req: StatusWorkerRequest = {
              kind: 'binary',
              buffer: event.data,
              offline,
            };
            this.worker.postMessage(req, [event.data]);
          } else {
            try {
              const status = decodeStatusBinary(event.data, offline);
              for (const listener of this.statusListeners) {
                listener(status);
              }
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              this.emitRawLog('error', `Binary decode error: ${msg}`);
            }
          }
        }
      };

      ws.onerror = () => {
        this.emitRawLog('error', `WebSocket error on ${wsUrl}`);
        if (!settled) {
          settled = true;
          this.setState('error', `WebSocket connection failed: ${wsUrl}`);
          reject(new Error(`WebSocket connection failed: ${wsUrl}`));
        }
      };

      ws.onclose = () => {
        if (this.ws === ws) {
          this.ws = null;
        }
        if (this.intentionalDisconnect) {
          this.setState('disconnected');
          this.emitRawLog('info', 'WebSocket disconnected');
        } else {
          // Never replay commands on reconnect — simply re-establish status telemetry stream
          this.setState('reconnecting');
          this.emitRawLog('info', 'WebSocket closed unexpectedly; scheduling reconnect');
          this.scheduleReconnect();
        }
      };
    });
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer();
    const delay = Math.min(
      this.reconnectDelayMs * Math.pow(2, this.reconnectAttempt),
      this.maxReconnectDelayMs,
    );
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      if (this.intentionalDisconnect) return;
      void this.openSocket().catch(() => {
        if (!this.intentionalDisconnect) {
          this.scheduleReconnect();
        }
      });
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  async disconnect(): Promise<void> {
    this.intentionalDisconnect = true;
    this.clearReconnectTimer();
    if (this.ws) {
      const socket = this.ws;
      this.ws = null;
      socket.close();
    }
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.setState('disconnected');
  }

  async invoke<TParams = unknown>(
    action: string,
    params?: unknown,
  ): Promise<KmxRpcResponse<TParams>> {
    const url = `${this.baseUrl}/api/kmx/${encodeURIComponent(action)}`;
    // kmxWeb expects `{}` (omitted `params`) for 0-argument RPCs like onCycleStart/onHalt/onFeedhold.
    const body =
      params === undefined || params === null ? '{}' : JSON.stringify({ params });
    this.emitRawLog('out', `POST /api/kmx/${action} ${body}`);

    const res = await this.fetchImpl(url, {
      method: 'POST',
      headers: this.buildHeaders({ 'Content-Type': 'application/json' }),
      body,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const message = `RPC ${action} failed (${res.status}): ${text || res.statusText}`;
      this.emitRawLog('error', message);
      throw new Error(message);
    }

    const json = (await res.json()) as KmxRpcResponse<TParams>;
    return json;
  }

  async jog(axis: number, speed: number): Promise<void> {
    await this.invoke('jog', [Math.trunc(axis), Math.trunc(speed)]);
  }

  async sendMdi(gcode: string): Promise<KmxRpcResponse> {
    return this.invoke('onMdi', gcode);
  }

  async setFixture(fixture: number): Promise<KmxRpcResponse> {
    return this.invoke('onSetFixture', Math.trunc(fixture));
  }

  async setOrigin(index: number, coords: number[]): Promise<KmxRpcResponse> {
    return this.invoke('onSetOrigin', [Math.trunc(index), ...coords]);
  }

  async setGcodeFile(path: string): Promise<KmxRpcResponse> {
    return this.invoke('setGcodeFile', path);
  }

  acknowledgeCallback(id: number, returnValue: number): void {
    const frame = encodeCallbackAck(id, returnValue);
    this.emitRawLog('out', frame);
    if (this.ws && this.ws.readyState === 1) {
      this.ws.send(frame);
    } else {
      this.emitRawLog('error', `Cannot send CB_ACK(${id}): WebSocket is not open`);
    }
  }

  onStatus(listener: (status: KmxStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  onMessage(listener: (message: ControlMessage) => void): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  onConnectionState(listener: (state: ConnectionState, error?: string) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  onRawLog(listener: (entry: RawLogEntry) => void): () => void {
    this.rawLogListeners.add(listener);
    return () => this.rawLogListeners.delete(listener);
  }
}

export interface HttpFileStorageOptions {
  baseUrl?: string;
  authToken?: string;
  fetchImpl?: typeof fetch;
}

export class HttpFileStorage implements FileStorage {
  private readonly baseUrl: string;
  private authToken: string | undefined;
  private readonly fetchImpl: typeof fetch;

  constructor(options: HttpFileStorageOptions = {}) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.authToken = options.authToken;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  setAuthToken(token: string | undefined): void {
    this.authToken = token;
  }

  private buildHeaders(extra?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = { ...extra };
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }
    return headers;
  }

  async listDir(path: string): Promise<DirListing> {
    const res = await this.fetchImpl(`${this.baseUrl}/api/kmx/listDir`, {
      method: 'POST',
      headers: this.buildHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ params: path }),
    });
    if (!res.ok) {
      throw new Error(`listDir(${path}) failed (${res.status})`);
    }
    const raw = (await res.json()) as {
      dir?: string;
      files?: Array<{ name: string; type: number }>;
      error?: string;
    };
    const files: DirEntry[] = (raw.files ?? []).map((entry) => ({
      name: entry.name,
      type: entry.type,
      isDirectory: entry.type === 4,
    }));
    return {
      dir: raw.dir ?? path,
      files,
      error: raw.error,
    };
  }

  async readFile(path: string): Promise<string> {
    const res = await this.fetchImpl(`${this.baseUrl}/api/kmx/openFile`, {
      method: 'POST',
      headers: this.buildHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ params: path }),
    });
    if (!res.ok) {
      throw new Error(`openFile(${path}) failed (${res.status})`);
    }
    return res.text();
  }

  async readBinary(path: string): Promise<ArrayBuffer> {
    const res = await this.fetchImpl(`${this.baseUrl}/api/kmx/openFile`, {
      method: 'POST',
      headers: this.buildHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ params: path }),
    });
    if (!res.ok) {
      throw new Error(`openFile(${path}) failed (${res.status})`);
    }
    return res.arrayBuffer();
  }

  async writeFile(
    path: string,
    content: string | ArrayBuffer | Uint8Array | Blob,
  ): Promise<void> {
    await this.uploadFile(path, content);
  }

  async uploadFile(
    path: string,
    content: string | ArrayBuffer | Uint8Array | Blob,
  ): Promise<string> {
    const formData = new FormData();
    let blob: Blob;
    if (content instanceof Blob) {
      blob = content;
    } else if (typeof content === 'string') {
      blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    } else if (content instanceof Uint8Array) {
      blob = new Blob([content.slice().buffer], { type: 'application/octet-stream' });
    } else {
      blob = new Blob([content], { type: 'application/octet-stream' });
    }
    formData.append('file', blob, path);

    const res = await this.fetchImpl(`${this.baseUrl}/upload`, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: formData,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`uploadFile(${path}) failed (${res.status}): ${text}`);
    }
    return res.text();
  }

  getResourceUrl(path: string): string {
    const clean = path.replace(/^\/+/, '');
    return `${this.baseUrl}/${clean}`;
  }
}
