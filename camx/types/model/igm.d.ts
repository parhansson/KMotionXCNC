import { IGMModelSettings } from './model.settings';
export interface GCodeVector {
    x: number;
    y: number;
    z: number;
    a: number;
    b: number;
    c: number;
}
export interface IgmObject {
    cmd: string;
    type: string;
    vectors: GCodeVector[];
    args: string[];
    bounds: BoundRect;
    node: any;
}
export interface LayerMap {
    [id: string]: IgmObject[];
}
export declare class IGM {
    metric: boolean;
    readonly layers: LayerMap;
    readonly layerKeys: any[];
    readonly textLayer: any[];
    readonly unsupported: any[];
    readonly rawLine: string[];
    constructor(metric?: boolean);
}
/**
 * All operations on an IGM should be done via IGMDriver operations
 */
export declare class IGMDriver {
    private igm;
    constructor(igm: IGM);
    addRaw(raw: string): void;
    addUnsupported(obj: any): void;
    addToLayerObject(layerKey: any, obj: IgmObject | IgmObject[], layerName?: string): void;
    readonly allObjectsFlat: IgmObject[];
    applyModifications(settings: IGMModelSettings): IgmObject[];
    static newIgmObject(): IgmObject;
    static newGCodeVector(x?: number, y?: number, z?: number, a?: number, b?: number, c?: number): GCodeVector;
    static vectorScale(thisV: GCodeVector, scale: number): GCodeVector;
    static vectorAdd(thisV: GCodeVector, v: GCodeVector): GCodeVector;
    static vectorEquals(thisV: GCodeVector, v: GCodeVector): boolean;
    static distanceSquared(thisV: GCodeVector, v: GCodeVector): number;
    static distanceTo(thisV: GCodeVector, v: GCodeVector): number;
    static doOperation(shape: IgmObject | IgmObject[], operation: (vec: GCodeVector) => void): IgmObject | IgmObject[];
    static translate(shape: IgmObject | IgmObject[], translateVec: GCodeVector): IgmObject | IgmObject[];
    static scale(shape: IgmObject | IgmObject[], ratio: number): IgmObject | IgmObject[];
    static clone(shape: IgmObject): IgmObject;
    static start(shape: IgmObject): GCodeVector;
    static end(shape: IgmObject): GCodeVector;
    static first<T>(arr: T[]): T;
    static last<T>(arr: T[]): T;
    static updateBounds(shapes: IgmObject[]): void;
    getMaxBounds(paths: IgmObject[]): BoundRect;
    /**
     * I know I know, This does not work
     */
    removeDuplicates(paths: IgmObject[]): number;
    removeSingularites(shapes: IgmObject[]): number;
    removeOutline(paths: IgmObject[], maxBounds: any): void;
    /**
     * Joining adjacent shapes. This implementation depends on orderNearestNeighbour first
     * However orderNearestNeighbour might check if reverse path is nearest and reverses
     * @param paths
     * @param fractionalDigits
     */
    joinAdjacent(paths: IgmObject[], fractionalDigits: number): number;
    pointEquals(v1: GCodeVector, v2: GCodeVector, fractionalDigits: number): boolean;
    orderNearestNeighbour(paths: IgmObject[], reversePaths: boolean): void;
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
    scale(ratio: any): this;
    vec1(): GCodeVector;
    vec2(): GCodeVector;
    include(vec: any): void;
    area(): number;
    height(): number;
    width(): number;
}
