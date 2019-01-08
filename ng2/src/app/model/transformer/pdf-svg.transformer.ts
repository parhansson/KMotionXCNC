import { Observer } from 'rxjs'
import { ModelSettingsService, ModelSettings } from '../model.settings.service'
import { ModelTransformer } from './model.transformer'
//import { PDFJS as pdfjs} from 'pdfjs-dist'
//import PDFJ from 'pdf'
//import 'pdfjs-dist/build/pdf.worker'
import * as pdfjs from 'pdfjs-dist/webpack'
//var PdfjsWorker = require('worker-loader!./build/pdf.worker.js');
//const PDFJS:PDFJSStatic = _PDFJSStatic

export class Pdf2SvgTransformer extends ModelTransformer<ArrayBuffer, SVGElement> {
  transformerSettings: ModelSettings

  constructor(private modelSettingsService: ModelSettingsService) {
    super()
    this.transformerSettings = modelSettingsService.settings
  }

  execute(source: ArrayBuffer, targetObserver: Observer<SVGElement>) {
    const PDFJS:PDFJSStatic = pdfjs
    //this will use base64 encoded instead of bloburls for images
    //PDFJS.disableCreateObjectURL = true;
    //
    PDFJS.disableFontFace = false
    PDFJS.disableWorker = false
    //currently does not work. fake worker is used
    //PDFJS.GlobalWorkerOptions.workerSrc = 'pdf.worker.js'
    //Another option is to set workerPort instead of workerSrc althogh workerSrc is promoted
    //const PdfjsWorker = require('worker-loader!./build/pdf.worker.js')
    //PDFJS.GlobalWorkerOptions.workerPort = new PdfjsWorker()

    // Fetch the PDF document from the URL using promises
    const transformer = this
    const scale = transformer.transformerSettings.pdf.scale
    const page = transformer.transformerSettings.pdf.page
    const rotate = transformer.transformerSettings.pdf.rotate

    PDFJS.getDocument(source).then((pdf) => {
      const numPages = pdf.numPages
      // Using promise to fetch the page

      // For testing only.
      const MAX_NUM_PAGES = 50
      const ii = Math.min(MAX_NUM_PAGES, numPages)
      const svgPages = []
      //let promise: Promise<SVGElement> = Promise.resolve<SVGElement>(undefined)
      let promise: Promise<any> = Promise.resolve()
      for (let i = 1; i <= ii; i++) {
        if (page != i) { continue }
        //when anchor is not null svg will be rendered on screen for debugging
        const anchor = null// this.createAnchor(i)
        // Using promise to fetch and render the next page
        promise = promise.then(function (pageNum:number, anchor: HTMLElement) {
          return pdf.getPage(pageNum).then(page => {
            const viewport = page.getViewport(scale,rotate)

            const container = this.createContainer(pageNum,viewport.width,viewport.height, anchor)

            return page.getOperatorList().then(opList => {
              const svgGfx: PDFJSStatic.SVGGraphics = new PDFJS.SVGGraphics(page.commonObjs, page.objs)
              svgGfx.embedFonts = true
              return svgGfx.getSVG(opList, viewport).then(svg => {
                transformer.logSvg(svg)
                if(container){
                  container.appendChild(svg)
                }
                targetObserver.next(svg)
              })
            })
          })
        }.bind(this, i, anchor))
      }
      //Destroy worker
      promise.then(result => pdf.destroy())
    })
  }
  private logSvg(svg: SVGElement){
    if(true == true) { return }
    const container = document.createElement('div')
    container.appendChild(svg)
    console.log('PDF-SVG', container.innerHTML)
  }
  createContainer(pageNum, width, height, parentElement: HTMLElement): HTMLDivElement {
    if(parentElement){
      const container = document.createElement('div')
      container.id = 'pageContainer' + pageNum
      container.className = 'pageContainer'
      container.style.width = width + 'px'
      container.style.height = height + 'px'
      parentElement.appendChild(container)
      return container
    }
  }
  createAnchor(pageNum): HTMLAnchorElement {
    const anchor = document.createElement('a')
    anchor.setAttribute('name', 'page=' + pageNum)
    anchor.setAttribute('title', 'Page ' + pageNum)
    document.body.appendChild(anchor)
    return anchor
  }

}
