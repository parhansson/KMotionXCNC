import type { IgmDocument } from '@kmxcnc/igm';
import { tessellateIgm } from './tessellate';
import type { RenderSceneData, TessellateOptions } from './types';

export interface TessellateWorkerRequest {
  id: number;
  doc: IgmDocument;
  options?: TessellateOptions;
}

export type TessellateWorkerResponse =
  | { id: number; result: RenderSceneData }
  | { id: number; error: string };

export interface TessellateWorkerClient {
  tessellate(doc: IgmDocument, options?: TessellateOptions): Promise<RenderSceneData>;
  dispose(): void;
}

interface WorkerScopeLike {
  onmessage: ((event: MessageEvent<TessellateWorkerRequest>) => void) | null;
  postMessage(message: TessellateWorkerResponse, transfer?: Transferable[]): void;
}

function isDedicatedWorkerContext(): boolean {
  return (
    typeof self !== 'undefined' &&
    typeof document === 'undefined' &&
    typeof (self as unknown as Partial<WorkerScopeLike>).postMessage === 'function'
  );
}

// Dedicated Web Worker entry point
if (isDedicatedWorkerContext()) {
  const workerSelf = self as unknown as WorkerScopeLike;
  workerSelf.onmessage = (event: MessageEvent<TessellateWorkerRequest>) => {
    const { id, doc, options } = event.data;
    try {
      const result = tessellateIgm(doc, options);
      const transferSet = new Set<ArrayBuffer>();
      for (const layer of result.layers) {
        transferSet.add(layer.positions.buffer as ArrayBuffer);
      }
      workerSelf.postMessage({ id, result }, Array.from(transferSet));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      workerSelf.postMessage({ id, error: message });
    }
  };
}

/**
 * Creates a client for offloading IGM tessellation to a dedicated Web Worker
 * with zero-copy ArrayBuffer transfer. Automatically falls back to main-thread
 * `tessellateIgm` when `Worker` is unavailable (e.g. Node.js / SSR / tests).
 */
export function createTessellateWorkerClient(
  workerFactory?: () => Worker,
): TessellateWorkerClient {
  let worker: Worker | null = null;
  let nextId = 1;
  let disposed = false;

  const pending = new Map<
    number,
    { resolve: (data: RenderSceneData) => void; reject: (err: Error) => void }
  >();

  const tryInitWorker = (): Worker | null => {
    if (disposed) return null;
    if (worker) return worker;
    if (!workerFactory && typeof Worker === 'undefined') {
      return null;
    }

    try {
      const instance = workerFactory
        ? workerFactory()
        : new Worker(new URL('./tessellate.worker.ts', import.meta.url), {
            type: 'module',
          });

      instance.onmessage = (event: MessageEvent<TessellateWorkerResponse>) => {
        const data = event.data;
        const entry = pending.get(data.id);
        if (!entry) return;
        pending.delete(data.id);
        if ('error' in data) {
          entry.reject(new Error(data.error));
        } else {
          entry.resolve(data.result);
        }
      };

      instance.onerror = (event: ErrorEvent) => {
        const err = new Error(event.message || 'Tessellation worker error');
        for (const entry of pending.values()) {
          entry.reject(err);
        }
        pending.clear();
        instance.terminate();
        worker = null;
      };

      worker = instance;
      return worker;
    } catch {
      return null;
    }
  };

  return {
    tessellate(doc: IgmDocument, options?: TessellateOptions): Promise<RenderSceneData> {
      if (disposed) {
        return Promise.reject(new Error('TessellateWorkerClient has been disposed'));
      }

      const activeWorker = tryInitWorker();
      if (!activeWorker) {
        try {
          return Promise.resolve(tessellateIgm(doc, options));
        } catch (err) {
          return Promise.reject(err instanceof Error ? err : new Error(String(err)));
        }
      }

      const id = nextId++;
      return new Promise<RenderSceneData>((resolve, reject) => {
        pending.set(id, { resolve, reject });
        const request: TessellateWorkerRequest = { id, doc, options };
        activeWorker.postMessage(request);
      });
    },

    dispose(): void {
      disposed = true;
      for (const entry of pending.values()) {
        entry.reject(new Error('TessellateWorkerClient disposed'));
      }
      pending.clear();
      if (worker) {
        worker.terminate();
        worker = null;
      }
    },
  };
}
