import { IGMModelSettings } from './model.settings';
import { Vector3, Vector2 } from './vector';
export interface GCodeVector {
    x: number;
    y: number;
    z: number;
    a: number;
    b: number;
    c: number;
}
export interface Limit {
    start: GCodeVector;
    end: GCodeVector;
}
export interface Geometry {
    limit?: Limit;
}
export interface ARC extends Geometry {
    type: 'ARC';
    x: number;
    y: number;
    radius: number;
    startAngle: number;
    endAngle: number;
    clockwise: boolean;
}
export interface LINE extends Geometry {
    type: 'LINE';
    vectors: GCodeVector[];
}
export interface IgmObject {
    bounds: BoundRect;
    comment?: string;
    geometry: ARC | LINE;
}
export interface LineObject extends IgmObject {
    geometry: LINE;
}
export interface ArcObject extends IgmObject {
    geometry: ARC;
}
export interface Layer {
    objects: IgmObject[];
    visible: boolean;
}
export interface LayerMap {
    [id: string]: Layer;
}
export interface LayerStatus {
    [id: string]: boolean;
}
export declare class IGM {
    metric: boolean;
    readonly layers: LayerMap;
    readonly textLayer: any[];
    readonly unsupported: any[];
    readonly rawLine: string[];
    readonly layerStatus: LayerStatus;
    constructor(metric?: boolean);
}
/**
 * All operations on an IGM should be done via IGMDriver operations
 */
export declare class IGMDriver {
    private igm;
    static newLine(vectors?: GCodeVector[]): LineObject;
    static newArc(x: number, //center of arc
    y: number, //center of arc
    radius: number, startAngle: number, endAngle: number, clockwise: boolean): ArcObject;
    private static newIgmObject;
    static newGCodeVector3(v: Vector3): {
        x: number;
        y: number;
        z: number;
        a: number;
        b: number;
        c: number;
    };
    static newGCodeVector(x?: number, y?: number, z?: number, a?: number, b?: number, c?: number): GCodeVector;
    constructor(igm: IGM);
    reverse(shape: IgmObject): void;
    private updateLimit;
    private updateLineLimit;
    private updateArcLimit;
    start(shape: IgmObject): GCodeVector;
    end(shape: IgmObject): GCodeVector;
    addRaw(raw: string): void;
    addUnsupported(obj: any): void;
    addToLayerObject(layerKey: string, obj: IgmObject | IgmObject[]): void;
    readonly allVisibleObjects: IgmObject[];
    readonly allObjectsFlat: IgmObject[];
    setLayerStatus(status: LayerStatus): void;
    applyModifications(settings: IGMModelSettings, onlyVisible?: boolean): IgmObject[];
    private vectorScale;
    private vectorAdd;
    private vectorEquals;
    private distanceSquared;
    private distanceTo;
    private doOperation;
    translate(input: IgmObject | IgmObject[], translateVec: GCodeVector): IgmObject | IgmObject[];
    scale(input: IgmObject | IgmObject[], ratio: number): IgmObject | IgmObject[];
    clone(shape: IgmObject): LineObject | ArcObject;
    updateBounds(shapes: IgmObject[]): void;
    private explode;
    getMaxBounds(shapes: IgmObject[]): BoundRect;
    private removeSingularites;
    private removeOutline;
    /**
     * Joining adjacent shapes. This implementation depends on orderNearestNeighbour first
     * However orderNearestNeighbour might check if reverse path is nearest and reverses
     * @param shapes
     * @param fractionalDigits
     */
    private joinAdjacent;
    private pointEquals;
    private orderNearestNeighbour;
    private nearest;
}
export declare class GCodeSource {
    lines: string[];
    text: string;
    constructor(gcode: string[] | string);
}
export declare class BoundRect {
    x: number;
    y: number;
    x2: number;
    y2: number;
    constructor();
    scale(ratio: number): this;
    vec1(): GCodeVector;
    vec2(): GCodeVector;
    include(vec: Vector2): void;
    area(): number;
    height(): number;
    width(): number;
}
