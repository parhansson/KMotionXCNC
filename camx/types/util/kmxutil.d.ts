export declare class KMXUtil {
    static createAnchor: {};
    static ab2str(buf: ArrayBuffer): string;
    static str2ab(str: string): ArrayBuffer;
    static injectScript(source: any, loadedCondition: any): Promise<unknown>;
    static getSingletonWorker(workerScript: any, messageHandler: any): Promise<Worker>;
    static workers: {};
    static debounce(func: (any: any) => any, wait: number, immediate: boolean): () => void;
    static svgToString(svg: SVGElement): string;
}
