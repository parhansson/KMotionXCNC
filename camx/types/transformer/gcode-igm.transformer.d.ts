import { IGM, IgmObject, GCodeVector } from '../model/igm';
import { Curve3 } from '../model/vector';
import { GCodeTransformer } from './gcode.transformer';
export declare class Gcode2IgmTransformer extends GCodeTransformer<IgmObject, IGM> {
    private driver;
    constructor(disableWorker?: boolean);
    protected createOutput(): IGM;
    protected startShape(): IgmObject;
    protected endShape(): void;
    protected addLinearPoint(newPosition: GCodeVector, shape: IgmObject): void;
    protected addCurve(curve: Curve3, shape: IgmObject): void;
}
