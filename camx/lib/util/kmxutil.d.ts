type WorkerMap = {
    [key: string]: Worker;
};
export declare const KMXUtil: {
    createAnchor: {};
    ab2str(buf: ArrayBuffer): string;
    str2ab(str: string): ArrayBuffer;
    injectScript(source: string, loadedCondition: boolean): Promise<unknown>;
    getSingletonWorker(workerScript: string, messageHandler: (this: Worker, ev: MessageEvent) => any): Promise<Worker>;
    workers: WorkerMap;
    svgToString(svg: SVGElement): string;
};
export {};
