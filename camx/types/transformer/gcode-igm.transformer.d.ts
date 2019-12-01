import { IGM, GCodeVector, LineObject } from '../model/igm';
import { Curve3 } from '../model/vector';
import { GCodeTransformer } from './gcode.transformer';
export declare class Gcode2IgmTransformer extends GCodeTransformer<LineObject, IGM> {
    private driver;
    constructor(disableWorker?: boolean);
    protected createOutput(): IGM;
    protected startShape(): LineObject;
    protected endShape(): void;
    protected addLinearPoint(newPosition: GCodeVector, shape: LineObject): void;
    protected addCurve(curve: Curve3, shape: LineObject): void;
}
