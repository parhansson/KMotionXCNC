

declare class DxfParser{
  constructor(stream?:any)
  parseSync(fileText:string)
}

// Merge PDFJS typings
declare namespace PDFJSStatic {
  export interface PDFPageOperatorList {
    argsArray: Object[],
    fnArray: Object[],
    lastChunk: boolean
  }
  export class SVGGraphics {
    constructor(
      objects: PDFObjects,
      objects1: PDFObjects,
      forceDataSchema?: boolean)

    getSVG(opList: PDFJSStatic.PDFPageOperatorList, viewport: PDFPageViewport):PDFPromise<SVGElement>;
  }

  export interface GlobalWorkerOptions {
    workerSrc: string
    workerPort: any //PdfjsWorker
  }
}
interface PDFObjects {
  objs: Object
}

//Extend PDFPageProxy
interface PDFPageProxy {
  getOperatorList(): PDFPromise<PDFJSStatic.PDFPageOperatorList>
  commonObjs: PDFObjects
  objs: PDFObjects
}

interface PDFJSStatic {
  getDocument(
    source: ArrayBuffer,
    pdfDataRangeTransport?: any,
    passwordCallback?: (fn: (password: string) => void, reason: string) => string,
    progressCallback?: (progressData: PDFProgressData) => void)
    : PDFPromise<PDFDocumentProxy>;
    
  GlobalWorkerOptions: PDFJSStatic.GlobalWorkerOptions 
  SVGGraphics: typeof PDFJSStatic.SVGGraphics
 }
