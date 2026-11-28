import type {
  BackendCapabilities,
  ConnectionState,
  ControlMessage,
  DirListing,
  KmxRpcResponse,
  KmxStatus,
  RawLogEntry,
} from './types';

export interface KmxTransport {
  readonly kind: 'http-ws' | 'mock' | (string & {});
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getConnectionState(): ConnectionState;
  getCapabilities(): Promise<BackendCapabilities>;
  invoke<TParams = unknown>(action: string, params?: unknown): Promise<KmxRpcResponse<TParams>>;
  jog(axis: number, speed: number): Promise<void>;
  sendMdi(gcode: string): Promise<KmxRpcResponse>;
  setFixture(fixture: number): Promise<KmxRpcResponse>;
  setOrigin(index: number, coords: number[]): Promise<KmxRpcResponse>;
  setGcodeFile(path: string): Promise<KmxRpcResponse>;
  acknowledgeCallback(id: number, returnValue: number): void;
  onStatus(listener: (status: KmxStatus) => void): () => void;
  onMessage(listener: (message: ControlMessage) => void): () => void;
  onConnectionState(listener: (state: ConnectionState, error?: string) => void): () => void;
  onRawLog(listener: (entry: RawLogEntry) => void): () => void;
}

export interface FileStorage {
  listDir(path: string): Promise<DirListing>;
  readFile(path: string): Promise<string>;
  readBinary(path: string): Promise<ArrayBuffer>;
  writeFile(path: string, content: string | ArrayBuffer | Uint8Array | Blob): Promise<void>;
  uploadFile(path: string, content: string | ArrayBuffer | Uint8Array | Blob): Promise<string>;
  getResourceUrl(path: string): string;
}
