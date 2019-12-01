export declare class KMXUtil {
    static createAnchor: {};
    static ab2str(buf: ArrayBuffer): string;
    static str2ab(str: string): ArrayBuffer;
    static injectScript(source: string, loadedCondition: boolean): Promise<unknown>;
    static getSingletonWorker(workerScript: string, messageHandler: (this: Worker, ev: MessageEvent) => any): Promise<Worker>;
    static workers: {
        [key: string]: Worker;
    };
    static debounce(func: (arg: any) => any, wait: number, immediate: boolean): () => void;
    static svgToString(svg: SVGElement): string;
}
