import { Curve3 } from '../model/vector';
import { GCodeVector } from '../model/igm';
import { GCodeTransformer } from './gcode.transformer';
import * as THREE from 'three';
export declare class Gcode2ThreeTransformer extends GCodeTransformer<THREE.Geometry, THREE.Group> {
    private interpolateShapeData;
    private moveShapeData;
    constructor(disableWorker?: boolean);
    protected createOutput(): THREE.Group;
    protected startShape(): THREE.Geometry;
    protected endShape(): void;
    private getShapeData;
    protected addLinearPoint(newPosition: GCodeVector, geometry: THREE.Geometry): GCodeVector;
    protected addCurve(curve: Curve3, geometry: THREE.Geometry): void;
    private createLinePrinter;
}
