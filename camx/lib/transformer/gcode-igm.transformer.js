import { IGM, IGMDriver } from '../model/igm';
import { GCodeTransformer } from './gcode.transformer';
//Copyright (c) 2014 par.hansson@gmail.com
export class Gcode2IgmTransformer extends GCodeTransformer {
    constructor(disableWorker) {
        super(disableWorker);
    }
    createOutput() {
        const model = new IGM();
        this.driver = new IGMDriver(model);
        return model;
    }
    startShape() {
        const shape = IGMDriver.newIgmObject();
        //shape.userData = { lineNo: this.state.lineNo }
        this.driver.addToLayerObject('layer1', shape);
        return shape;
    }
    endShape() {
        //TODO
        //setBounds on shape since it is modified without knowledge by driver
    }
    addLinearPoint(newPosition, shape) {
        shape.vectors.push(newPosition);
    }
    addCurve(curve, shape) {
        const vectors = curve.getPoints(50);
        for (const point of vectors) {
            shape.vectors.push(IGMDriver.newGCodeVector(point.x, point.y, point.z));
        }
    }
}
//# sourceMappingURL=gcode-igm.transformer.js.map