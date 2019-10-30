// interface GlobalWorkerOptions {
//   workerSrc: string
//   workerPort: any //PdfjsWorker
// }
// interface PDFObjects {
//   objs: Object
// }
//Extend PDFPageProxy
// interface PDFPageProxy{
//   getOperatorList(): PDFPromise<PDFPageOperatorList>
//   commonObjs: PDFObjects
//   objs: PDFObjects
// }
// interface PDFJSStatic {
//     bulle:boolean
// getDocument(
//     url: string,
//     pdfDataRangeTransport?: PDFDataRangeTransport,
//     passwordCallback?: (fn: (password: string) => void, reason: string) => string,
//     progressCallback?: (progressData: PDFProgressData) => void
// ): PDFLoadingTask<PDFDocumentProxy>;
// getDocument(
//     data: Uint8Array | BufferSource,
//     pdfDataRangeTransport?: PDFDataRangeTransport,
//     passwordCallback?: (fn: (password: string) => void, reason: string) => string,
//     progressCallback?: (progressData: PDFProgressData) => void
// ): PDFLoadingTask<PDFDocumentProxy>;
// getDocument(
//     source: PDFSource,
//     pdfDataRangeTransport?: PDFDataRangeTransport,
//     passwordCallback?: (fn: (password: string) => void, reason: string) => string,
//     progressCallback?: (progressData: PDFProgressData) => void
// ): PDFLoadingTask<PDFDocumentProxy>;
//GlobalWorkerOptions: PDFJSStatic.GlobalWorkerOptions 
//GlobalWorkerOptions: GlobalWorkerOptions 
//SVGGraphics: typeof PDFJSStatic.SVGGraphics
//PDFViewer(params: PDFViewerParams): void;
/**
* yet another viewer, this will render only one page at the time, reducing rendering time
* very important for mobile development
* @params {PDFViewerParams}
*/
//PDFSinglePageViewer(params: PDFViewerParams): void;    
//  }
//  declare module 'pdfjs-dist/webpack' {
//   export var PDFJS:PDFJSStatic
// }
//# sourceMappingURL=pdfjs-merge-typings.js.map