//dummy class to be exported from workers
//however the acutal implementation is not used since worker-loader
//handles the module
export class WebpackWorker implements Worker{
  constructor(){}
    onmessage: ((this: Worker, ev: MessageEvent) => any) | null

    postMessage(message: any, options?: PostMessageOptions | Transferable[]): void
    postMessage(message: any, transfer: Transferable[]): void {}

    terminate(): void  {}

    addEventListener<K extends keyof WorkerEventMap>(type: K, listener: (this: Worker, ev: WorkerEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void
    addEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions): void
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void  {}

    removeEventListener<K extends keyof WorkerEventMap>(type: K, listener: (this: Worker, ev: WorkerEventMap[K]) => any, options?: boolean | EventListenerOptions): void
    removeEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: EventListenerOptions | boolean): void
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void {}

    dispatchEvent(event: Event): boolean {return true}

    onerror: ((this: AbstractWorker, ev: ErrorEvent) => any) | null
}