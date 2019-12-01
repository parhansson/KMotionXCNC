
import { IGM, IGMDriver, IgmObject, GCodeVector, LineObject } from '../model/igm'
import { Curve3 } from '../model/vector'
import { GCodeTransformer, State } from './gcode.transformer'
//Copyright (c) 2014 par.hansson@gmail.com


export class Gcode2IgmTransformer extends GCodeTransformer<LineObject, IGM>{
  private driver: IGMDriver
  constructor(disableWorker?: boolean) { 
    super(disableWorker) 
  }
  protected createOutput() {
    const model = new IGM()
    this.driver = new IGMDriver(model)
    return model
  }

  protected startShape() {
    const shape = IGMDriver.newLine()
    //shape.userData = { lineNo: this.state.lineNo }
    this.driver.addToLayerObject('layer1',shape)
    return shape
  }

  protected endShape(){
    //TODO
    //setBounds on shape since it is modified without knowledge by driver
  }

  protected addLinearPoint(newPosition: GCodeVector, shape: LineObject) {
    shape.geometry.vectors.push(newPosition)
  }
  protected addCurve(curve: Curve3, shape: LineObject) {
    const vectors = curve.getPoints(50)
    for (const point of vectors) {
      shape.geometry.vectors.push(IGMDriver.newGCodeVector(point.x, point.y, point.z))
    }
  }

}
