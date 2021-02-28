declare module 'pdfjs-dist/webpack' {
    export * from "pdfjs-dist";
    import {
        PDFOperatorList,
        //PDFObjects //Not exported
    } from "pdfjs-dist/types/display/api.js";
    import {
        PageViewport,
    } from "pdfjs-dist/types/display/display_utils.js";

    export class SVGGraphics {

        constructor(
            commonObjs: any,// PDFObjects?
            objs: PDFObjects,
            forceDataSchema?: boolean)

        embedFonts: boolean // "embeds" fonts as blob urls.

        getSVG(opList: PDFOperatorList, viewport: PageViewport): Promise<SVGElement>
        _setStrokeAttributes(element: SVGGraphicsElement, lineWidthScale?: number/* = 1*/): void
    }

  // interface PDFObjects {
  //   objs: { [key: string]: { data: FontFaceObject | HTMLImageElement }; }
  // }

//   interface FontFaceObject {
//     data: Uint8Array
//     mimetype: string
//     loadedName: string
//   }

    /**
 * A PDF document and page is built of many objects. E.g. there are objects for
 * fonts, images, rendering code, etc. These objects may get processed inside of
 * a worker. This class implements some basic methods to manage these objects.
 * @ignore
 */
    export class PDFObjects {
        _objs: any;
        /**
         * Ensures there is an object defined for `objId`.
         * @private
         */
        //private _ensureObj;
        /**
         * If called *without* callback, this returns the data of `objId` but the
         * object needs to be resolved. If it isn't, this method throws.
         *
         * If called *with* a callback, the callback is called with the data of the
         * object once the object is resolved. That means, if you call this method
         * and the object is already resolved, the callback gets called right away.
         */
        get(objId: any, callback?: any): any;
        has(objId: any): any;
        /**
         * Resolves the object `objId` with optional `data`.
         */
        resolve(objId: any, data: any): void;
        clear(): void;
    }
}