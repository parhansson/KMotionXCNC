import { Curve3, Vector3, MoveArcArguments, MoveArguments } from '../model/vector';
import { Block, Word } from '../gcode';
import { GCodeSource, GCodeVector } from '../model/igm';
import { ModelTransformer } from './model.transformer';
export declare class ModalGroup {
    private groupCodes?;
    constructor(initialState: string, groupCodes?: string[]);
    changed: boolean;
    code: string;
    setActiveCode(newCode: string): void;
}
export declare class GCodeState {
    moveGroup: ModalGroup;
    planeGroup: ModalGroup;
    distanceGroup: ModalGroup;
    spindleSpeedGroup: ModalGroup;
    unitsGroup: ModalGroup;
    position: GCodeVector;
}
export declare class State<ShapeType> extends GCodeState {
    scale: number;
    absolute: boolean;
    currentShape: ShapeType;
    lineNo: number;
    onBlock(block: Block): void;
    handleWord(cmd: Word): void;
    private wordHandlers;
}
export declare abstract class GCodeTransformer<ShapeType, OutputType> implements ModelTransformer<GCodeSource, OutputType> {
    protected disableWorker?: boolean;
    output: OutputType;
    protected state: State<ShapeType>;
    constructor(disableWorker?: boolean);
    protected abstract createOutput(): OutputType;
    protected abstract startShape(): ShapeType;
    protected abstract endShape(): void;
    protected abstract addLinearPoint(newPosition: GCodeVector, shape: ShapeType): void;
    protected abstract addCurve(curve: Curve3, shape: ShapeType): void;
    transform(gcode: GCodeSource): Promise<OutputType>;
    private onBlock;
    private onEndProgram;
    private onStartShape;
    private onEndShape;
    protected onWordParameter(args: MoveArguments): void;
    private createCurve;
    private getNewPosition;
    private containsMoveData;
}
export declare class GCodeCurve3 extends Curve3 {
    private startPoint;
    private readonly plane;
    private readonly deltaZ;
    private delegate;
    constructor(startPoint: GCodeVector, endPoint: GCodeVector, args: MoveArcArguments, clockWise: boolean, plane: 'G17' | 'G18' | 'G19');
    getPoint(t: number): Vector3;
    getPoints(divisions: number): Vector3[];
}
