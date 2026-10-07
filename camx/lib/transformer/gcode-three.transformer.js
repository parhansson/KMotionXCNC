"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Gcode2ThreeTransformer = void 0;
const gcode_transformer_1 = require("./gcode.transformer");
const THREE = __importStar(require("three"));
class Gcode2ThreeTransformer extends gcode_transformer_1.GCodeTransformer {
    constructor(disableWorker) {
        super(disableWorker);
        // Create the final Object3d to add to the scene
        // interpolateColor = new THREE.Color(0x080808);
        // positionColor = new THREE.Color(0xAAAAFF);
        // lineMaterial = new THREE.LineBasicMaterial({
        //   opacity: 0.6,
        //   transparent: true,
        //   linewidth: 1,
        //   vertexColors: THREE.FaceColors
        // });
        this.interpolateShapeData = {
            material: new THREE.LineBasicMaterial({
                opacity: 0.6,
                transparent: true,
                linewidth: 1,
                color: 0x080808
            })
        };
        this.moveShapeData = {
            // material: new THREE.LineBasicMaterial({
            //   opacity: 0.6,
            //   transparent: true,
            //   linewidth: 1,
            //   color: 0xAAAAFF
            // })
            material: new THREE.LineDashedMaterial({
                gapSize: 1,
                dashSize: 2,
                opacity: 0.6,
                transparent: true,
                linewidth: 1,
                color: 0xAA0000,
            })
        };
    }
    createOutput() {
        const output = new THREE.Group();
        output.name = 'GCODE';
        return output;
    }
    startShape() {
        const data = this.getShapeData();
        const lineGeometry = new THREE.Geometry();
        const shape = new THREE.Line(lineGeometry, data.material);
        shape.userData = { startLine: this.state.lineNo };
        this.output.add(shape);
        //console.log("new line");
        return lineGeometry;
    }
    endShape() {
        // if(this.state.currentShape){
        //   this.state.currentShape.userData.endLine = this.state.lineNo
        // }
        const state = this.state;
        const shapes = this.output.children;
        if (shapes.length > 0) {
            const shape = shapes[shapes.length - 1];
            shape.userData.endLine = state.lineNo;
            //Needed if line dashed material
            shape.computeLineDistances();
        }
    }
    getShapeData() {
        const state = this.state;
        switch (state.moveGroup.code) {
            case ('G0'):
                return this.moveShapeData;
            case ('G1'):
                return this.interpolateShapeData;
            case ('G2'):
                return this.interpolateShapeData;
            case ('G3'):
                return this.interpolateShapeData;
            default: throw new Error(`Invalid G Gode ${state.moveGroup.code}`);
        }
    }
    addLinearPoint(newPosition, geometry) {
        geometry.vertices.push(new THREE.Vector3(newPosition.x, newPosition.y, newPosition.z));
        //let color = getShapeData()
        //geometry.colors.push(color);
        return newPosition;
    }
    addCurve(curve, geometry) {
        const vectors = curve.getPoints(50);
        for (const point of vectors) {
            geometry.vertices.push(new THREE.Vector3(point.x, point.y, point.z));
        }
        //let color = getShapeData()
        // new THREE.Vector3().fromAttribute
        // for (var i = 0; i < vectors.length; i++) {
        //   geometry.colors.push(color);
        // }
    }
    //use for 3dprinter files
    //Need a way to rename axis to use E axis as extrude parameter
    createLinePrinter(args, position, newPosition, geometry) {
        newPosition.e = args.E !== undefined ? args.E : position.e,
            //TODO doesn't work as expected due to changing feedrate in the middle of line.
            newPosition.extruding = (newPosition.e - position.e) > 0;
        if (newPosition.extruding) {
            const color = new THREE.Color(newPosition.extruding ? 0xBBFFFF : 0xFF00FF);
            geometry.vertices.push(new THREE.Vector3(position.x, position.y, position.z));
            geometry.vertices.push(new THREE.Vector3(newPosition.x, newPosition.y, newPosition.z));
            geometry.colors.push(color);
            geometry.colors.push(color);
        }
        return newPosition;
    }
}
exports.Gcode2ThreeTransformer = Gcode2ThreeTransformer;
