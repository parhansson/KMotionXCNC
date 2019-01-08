
import { Observer } from 'rxjs'
import { IGM, IGMDriver, IgmObject } from '../igm'
import { ModelTransformer } from './model.transformer'
import { SVGModelSettings } from '../model.settings.service'
import { SvgNode, SvgParser } from '../svg-parser'

export class Svg2IgmTransformer extends ModelTransformer<SVGElement, IGM>{

  constructor(private settings: SVGModelSettings) {
    super()
  }

  execute(svgRootElement: SVGElement, targetObserver: Observer<IGM>) {

    const igm = new IGM()
    const driver = new IGMDriver(igm)

    // let the fun begin

    const contentFilterDissalowed = [
      //'style', 
      //'defs'
    ]
    const contentFilter = (element: SVGElement) => {
      return contentFilterDissalowed.indexOf(element.localName) < 0
    }

    new SvgParser(contentFilter, this.settings.renderText).parse(svgRootElement).then(node => {
      this.makeModel(node, driver)
      targetObserver.next(igm)
    })
  }

  private makeModel(node: SvgNode, driver: IGMDriver) {
    if(node.defs) { return }
    if(node.unsupported) { return }
    //if stroke is undefined we do not generate shape
    //TODO this should be handled in igm.addToLayerObject as invisible layer
    //sometimes an invisible outline is present in pdf files
    //if both fill and stroke is undefined skip since it is invisible
    const hasFill = node.fill && node.fill !== 'none' 
    const hasStroke = node.stroke && node.stroke !== 'none' 
    if(
      //hasFill || 
      hasStroke || 
      node.text) {
      //console.log('stroke', node.stroke)
      this.makeShape(node, driver)
    }
    for (const child of node.children) {
      this.makeModel(child, driver)
    }
  }

  private makeShape(node: SvgNode, driver: IGMDriver) {
    const dpiScaleFactor = this.settings.getDPIScaleFactor()
    for (const subpath of node.path) {
      const shape = IGMDriver.newIgmObject()
      shape.type = 'Linear interpolation'
      shape.cmd = 'G1'
      shape.node = node //Not currently in use
      for (const point of subpath) {
        shape.vectors.push(IGMDriver.newGCodeVector(point[0], point[1], 0))
        //TODO clip on clipPath here. this will be extremely difficult
      }
      IGMDriver.scale(shape, dpiScaleFactor)

      if (node.unsupported === true) {
        driver.addUnsupported(subpath)
      } else {
        //this.boundarys.allcolors.push(subpath);
        driver.addToLayerObject(node.stroke, shape)
      }
    }
  }
}
