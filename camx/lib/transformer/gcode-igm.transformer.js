"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Gcode2IgmTransformer = void 0;
const igm_1 = require("../model/igm");
const gcode_transformer_1 = require("./gcode.transformer");
//Copyright (c) 2014 par.hansson@gmail.com
class Gcode2IgmTransformer extends gcode_transformer_1.GCodeTransformer {
    constructor(disableWorker) {
        super(disableWorker);
    }
    createOutput() {
        const model = new igm_1.IGM();
        this.driver = new igm_1.IGMDriver(model);
        return model;
    }
    startShape() {
        const shape = igm_1.IGMDriver.newLine();
        //shape.userData = { lineNo: this.state.lineNo }
        this.driver.addToLayerObject('layer1', shape);
        return shape;
    }
    endShape() {
        //TODO
        //setBounds on shape since it is modified without knowledge by driver
    }
    addLinearPoint(newPosition, shape) {
        shape.geometry.vectors.push(newPosition);
    }
    addCurve(curve, shape) {
        const vectors = curve.getPoints(50);
        for (const point of vectors) {
            shape.geometry.vectors.push(igm_1.IGMDriver.newGCodeVector(point.x, point.y, point.z));
        }
    }
}
exports.Gcode2IgmTransformer = Gcode2IgmTransformer;
