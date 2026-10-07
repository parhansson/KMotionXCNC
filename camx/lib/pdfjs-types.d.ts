import { PDFOperatorList } from "pdfjs-dist/types/src/display/api";
import { PageViewport } from "pdfjs-dist";
export declare class SVGGraphics {
    /** @type {PDFObjects} */
    constructor(commonObjs: PDFObjects, // PDFObjects?
    objs: PDFObjects, forceDataSchema?: boolean);
    current: SVGExtraState;
    embedFonts: boolean;
    getSVG(opList: PDFOperatorList, viewport: PageViewport): Promise<SVGElement>;
    _setStrokeAttributes(element: SVGGraphicsElement, lineWidthScale?: number): void;
}
declare class PDFObjects {
    /**
     * If called *without* callback, this returns the data of `objId` but the
     * object needs to be resolved. If it isn't, this method throws.
     *
     * If called *with* a callback, the callback is called with the data of the
     * object once the object is resolved. That means, if you call this method
     * and the object is already resolved, the callback gets called right away.
     *
     * @param {string} objId
     * @param {function} [callback]
     * @returns {any}
     */
    get(objId: string, callback?: Function | undefined): any;
    /**
     * @param {string} objId
     * @returns {boolean}
     */
    has(objId: string): boolean;
    /**
     * Resolves the object `objId` with optional `data`.
     *
     * @param {string} objId
     * @param {any} [data]
     */
    resolve(objId: string, data?: any): void;
    clear(): void;
}
type SVGExtraState = {
    fontSizeScale: number;
    fontWeight: string;
    fontSize: number;
    textMatrix: any;
    fontMatrix: any;
    leading: number;
    textRenderingMode: any;
    textMatrixScale: number;
    x: number;
    y: number;
    lineX: number;
    lineY: number;
    charSpacing: number;
    wordSpacing: number;
    textHScale: number;
    textRise: number;
    fillColor: string;
    strokeColor: string;
    fillAlpha: number;
    strokeAlpha: number;
    lineWidth: number;
    lineJoin: string;
    lineCap: string;
    miterLimit: number;
    dashArray: any[];
    dashPhase: number;
    dependencies: any[];
    activeClipUrl: null | string | any;
    clipGroup: any;
    maskId: string;
};
export {};
