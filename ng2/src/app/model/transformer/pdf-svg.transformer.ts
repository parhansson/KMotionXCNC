import { Observer } from 'rxjs/Rx'
import { ModelSettingsService, ModelSettings } from '../model.settings.service'
import { ModelTransformer } from './model.transformer'
import { PDFJS as pdfjs} from 'pdfjs-dist'

export class Pdf2SvgTransformer extends ModelTransformer<ArrayBuffer, SVGElement> {
  transformerSettings: ModelSettings

  constructor(private modelSettingsService: ModelSettingsService) {
    super()
    this.transformerSettings = modelSettingsService.settings
  }

  execute(source: ArrayBuffer, targetObserver: Observer<SVGElement>) {
    //this will use base64 encoded instead of bloburls for images
    //PDFJS.disableCreateObjectURL = true;
    //
    const PDFJS:PDFJSStatic = pdfjs
    PDFJS.disableFontFace = true
    PDFJS.workerSrc='assets/pdf.worker.js'
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
        const anchor = null//createAnchor(i);
        if (page != i) { continue }
        // Using promise to fetch and render the next page
        promise = promise.then(function (pageNum, anchor) {
          return pdf.getPage(pageNum).then(page => {
            const viewport = page.getViewport(scale,rotate)

            // var container = createContainer(pageNum,viewport.width,viewport.height);
            //  anchor.appendChild(container);

            return page.getOperatorList().then(opList => {
              const svgGfx: PDFJSExtra.SVGGraphics = new PDFJS.SVGGraphics(page.commonObjs, page.objs)
              return svgGfx.getSVG(opList, viewport).then(svg => {
                transformer.logSvg(svg)
                targetObserver.next(svg)
                //svgObserver.complete()
                //pdf.destroy() //Destroy worker
                //return svg
              })
            })
          })
        }.bind(null, i, anchor))
      }
      promise.then(result => pdf.destroy())
    })
  }
  private logSvg(svg: SVGElement){
    if(true == true) { return }
    const container = document.createElement('div')
    container.appendChild(svg)
    console.log('PDF-SVG', container.innerHTML)
  }
  createContainer(pageNum, width, height) {
    const container = document.createElement('div')
    container.id = 'pageContainer' + pageNum
    container.className = 'pageContainer'
    container.style.width = width + 'px'
    container.style.height = height + 'px'
    return container
  }
  createAnchor(pageNum) {
    const anchor = document.createElement('a')
    anchor.setAttribute('name', 'page=' + pageNum)
    anchor.setAttribute('title', 'Page ' + pageNum)
    document.body.appendChild(anchor)
    return anchor
  }

}
