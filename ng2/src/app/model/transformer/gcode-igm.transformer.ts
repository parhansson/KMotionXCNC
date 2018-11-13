
import { IGM, IGMDriver, IgmObject, GCodeVector } from '../igm'
import { GCodeCurve3 } from '../vector'
import { GCodeTransformer, State } from './gcode.transformer'
//Copyright (c) 2014 par.hansson@gmail.com


export class Gcode2IgmTransformer extends GCodeTransformer<IgmObject, IGM>{
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
    const shape = IGMDriver.newIgmObject()
    //shape.userData = { lineNo: this.state.lineNo }
    this.driver.addToLayerObject('layer1',shape)
    return shape
  }

  protected endShape(){
    //TODO
    //setBounds on shape since it is modified without knowledge by driver
  }

  protected addLinearPoint(newPosition: GCodeVector, shape: IgmObject) {
    shape.vectors.push(newPosition)
  }
  protected addCurve(curve: GCodeCurve3, shape: IgmObject) {
    const vectors = curve.getPoints(50)
    for (const point of vectors) {
      shape.vectors.push(point)
    }
  }

}
