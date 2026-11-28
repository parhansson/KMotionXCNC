import { decodeStatusBinary, decodeTextMessage, type DecodedWsMessage } from './decoder';
import type { KmxStatus } from './types';

export type StatusWorkerRequest =
  | { kind: 'binary'; buffer: ArrayBuffer; offline?: boolean }
  | { kind: 'text'; text: string };

export type StatusWorkerResponse =
  | { kind: 'status'; status: KmxStatus }
  | { kind: 'decoded'; decoded: DecodedWsMessage }
  | { kind: 'error'; error: string };

interface WorkerScopeLike {
  onmessage: ((event: MessageEvent<StatusWorkerRequest>) => void) | null;
  postMessage(message: StatusWorkerResponse): void;
}

const workerScope = globalThis as unknown as Partial<WorkerScopeLike>;

if (typeof workerScope.postMessage === 'function') {
  workerScope.onmessage = (event: MessageEvent<StatusWorkerRequest>) => {
    const msg = event.data;
    try {
      if (msg.kind === 'binary') {
        const status = decodeStatusBinary(msg.buffer, msg.offline ?? false);
        workerScope.postMessage!({ kind: 'status', status });
      } else if (msg.kind === 'text') {
        const decoded = decodeTextMessage(msg.text);
        workerScope.postMessage!({ kind: 'decoded', decoded });
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      workerScope.postMessage!({ kind: 'error', error });
    }
  };
}
