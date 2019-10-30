import { ModelTransformer } from './model.transformer';
import * as pdfjs from 'pdfjs-dist/webpack';
//These types comes from types-merge
import { getDocument, SVGGraphics } from 'pdfjs-dist/webpack';
export class Pdf2SvgTransformer extends ModelTransformer {
    constructor(transformerSettings) {
        super();
        this.transformerSettings = transformerSettings;
    }
    execute(source, targetObserver) {
        //let s  = new SVGGraphics(null,null,null)
        const PDFJS = pdfjs;
        //this will use base64 encoded instead of bloburls for images
        //PDFJS.disableCreateObjectURL = true
        //
        PDFJS.disableFontFace = false;
        PDFJS.disableWorker = false;
        //currently does not work. fake worker is used
        //PDFJS.GlobalWorkerOptions.workerSrc = 'pdf.worker.js'
        //Another option is to set workerPort instead of workerSrc althogh workerSrc is promoted
        //const PdfjsWorker = require('worker-loader!./build/pdf.worker.js')
        //PDFJS.GlobalWorkerOptions.workerPort = new PdfjsWorker()
        // Fetch the PDF document from the URL using promises
        const transformer = this;
        const scale = transformer.transformerSettings.pdf.scale;
        const page = transformer.transformerSettings.pdf.page;
        const rotation = transformer.transformerSettings.pdf.rotate;
        //PDFJS.getDocument(source).promise.then((pdf) => {
        getDocument(source).promise.then((pdf) => {
            const numPages = pdf.numPages;
            // Using promise to fetch the page
            // For testing only.
            const MAX_NUM_PAGES = 50;
            const ii = Math.min(MAX_NUM_PAGES, numPages);
            const svgPages = [];
            //let promise: Promise<SVGElement> = Promise.resolve<SVGElement>(undefined)
            let promise = Promise.resolve();
            for (let i = 1; i <= ii; i++) {
                if (page != i) {
                    continue;
                }
                //when anchor is not null svg will be rendered on screen for debugging
                const anchor = null; // this.createAnchor(i)
                // Using promise to fetch and render the next page
                promise = promise.then(function (pageNum, anchor) {
                    return pdf.getPage(pageNum).then(page => {
                        const viewport = page.getViewport({ scale, rotation });
                        const container = this.createContainer(pageNum, viewport.width, viewport.height, anchor);
                        return page.getOperatorList().then(opList => {
                            const svgGfx = new SVGGraphics(page.commonObjs, page.objs);
                            //apply monkey patch for zero width strokes
                            svgGfx._setStrokeAttributes = _setStrokeAttributes.bind(svgGfx);
                            svgGfx.embedFonts = true;
                            return svgGfx.getSVG(opList, viewport).then(svg => {
                                transformer.logSvg(svg);
                                if (container) {
                                    container.appendChild(svg);
                                }
                                targetObserver.next(svg);
                            });
                        });
                    });
                }.bind(this, i, anchor));
            }
            //Destroy worker
            promise.then(result => pdf.destroy());
        });
    }
    logSvg(svg) {
        if (true == true) {
            return;
        }
        const container = document.createElement('div');
        container.appendChild(svg);
        console.log('PDF-SVG', container.innerHTML);
    }
    createContainer(pageNum, width, height, parentElement) {
        if (parentElement) {
            const container = document.createElement('div');
            container.id = 'pageContainer' + pageNum;
            container.className = 'pageContainer';
            container.style.width = width + 'px';
            container.style.height = height + 'px';
            parentElement.appendChild(container);
            return container;
        }
    }
    createAnchor(pageNum) {
        const anchor = document.createElement('a');
        anchor.setAttribute('name', 'page=' + pageNum);
        anchor.setAttribute('title', 'Page ' + pageNum);
        document.body.appendChild(anchor);
        return anchor;
    }
}
function _setStrokeAttributes(element, lineWidthScale = 1) {
    const current = this.current;
    let dashArray = current.dashArray;
    if (lineWidthScale !== 1 && dashArray.length > 0) {
        dashArray = dashArray.map(function (value) {
            return lineWidthScale * value;
        });
    }
    element.setAttributeNS(null, 'stroke', current.strokeColor);
    element.setAttributeNS(null, 'stroke-opacity', current.strokeAlpha);
    element.setAttributeNS(null, 'stroke-miterlimit', pf(current.miterLimit));
    element.setAttributeNS(null, 'stroke-linecap', current.lineCap);
    element.setAttributeNS(null, 'stroke-linejoin', current.lineJoin);
    //monkey patch
    if (current.lineWidth == 0) {
        element.setAttributeNS(null, 'stroke-width', pf(lineWidthScale * 1) + 'px');
        element.setAttributeNS(null, 'vector-effect', 'non-scaling-stroke');
    }
    else {
        element.setAttributeNS(null, 'stroke-width', pf(lineWidthScale * current.lineWidth) + 'px');
    }
    element.setAttributeNS(null, 'stroke-dasharray', dashArray.map(pf).join(' '));
    element.setAttributeNS(null, 'stroke-dashoffset', pf(lineWidthScale * current.dashPhase) + 'px');
}
/**
 * Format a float number as a string.
 *
 * @param value {number} - The float number to format.
 * @returns {string}
 */
// eslint-disable-next-line no-inner-declarations
function pf(value) {
    if (Number.isInteger(value)) {
        return value.toString();
    }
    const s = value.toFixed(10);
    let i = s.length - 1;
    if (s[i] !== '0') {
        return s;
    }
    // Remove trailing zeros.
    do {
        i--;
    } while (s[i] === '0');
    return s.substring(0, s[i] === '.' ? i : i + 1);
}
//# sourceMappingURL=pdf-svg.transformer.js.map