import {
  PDFJSStatic as PDFJSStatic_Orig,
  PDFPageProxy as PDFPageProxy_Orig,
  PDFDocumentProxy as PDFDocumentProxy_Orig,
  PDFPageViewport,
  PDFPromise,
  PDFJSStatic,
  PDFDataRangeTransport,
  PDFProgressData,
  PDFLoadingTask
} from "pdfjs-dist";


declare module 'pdfjs-dist/webpack' {

  export function getDocument(
    data: Uint8Array | BufferSource,
    pdfDataRangeTransport?: PDFDataRangeTransport,
    passwordCallback?: (fn: (password: string) => void, reason: string) => string,
    progressCallback?: (progressData: PDFProgressData) => void
  ): PDFLoadingTask<PDFDocumentProxy>;

  const SVGGraphics: {
    prototype: SVGGraphics;
    new(commonObjs: PDFObjects,
      objs: PDFObjects,
      forceDataSchema?: boolean): SVGGraphics;
  };

  export interface SVGGraphics {

    embedFonts: boolean // "embeds" fonts as blob urls.

    getSVG(opList: PDFPageOperatorList, viewport: PDFPageViewport): PDFPromise<SVGElement>
    _setStrokeAttributes(element: SVGGraphicsElement, lineWidthScale?: number/* = 1*/): void
  }
  export interface PDFJSStatic extends PDFJSStatic_Orig {
    //We need to override return type with local PDFDocumentProxy
    //to trick tsc into using local version of PDFPageProxy in the end
    getDocument(
      data: Uint8Array | BufferSource,
      pdfDataRangeTransport?: PDFDataRangeTransport,
      passwordCallback?: (fn: (password: string) => void, reason: string) => string,
      progressCallback?: (progressData: PDFProgressData) => void
    ): PDFLoadingTask<PDFDocumentProxy>;
  }
  interface PDFDocumentProxy extends PDFDocumentProxy_Orig {
    getPage(number: number): PDFPromise<PDFPageProxy>;
  }

  export interface PDFPageProxy extends PDFPageProxy_Orig {
    getOperatorList(): PDFPromise<PDFPageOperatorList>
    commonObjs: PDFObjects
    objs: PDFObjects
  }

  interface FontFaceObject {
    data: Uint8Array
    mimetype: string
    loadedName: string
  }

  interface PDFObjects {
    objs: { [key: string]: { data: FontFaceObject | HTMLImageElement }; }
  }

  export interface PDFPageOperatorList {
    argsArray: Object[],
    fnArray: Object[],
    lastChunk: boolean
  }
}