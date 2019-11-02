import { IGM } from '../model/igm';
export declare class MitreBox {
    width: number;
    height: number;
    depth: number;
    materialThickness: number;
    private models;
    private cut_width;
    constructor(width: number, height: number, depth: number, materialThickness: number);
    generate(): IGM;
    private MitrePanel;
    protected PolyStart(): void;
    private getLast;
    protected PolyPoint(x: number, y: number): void;
    protected PolyEnd(): void;
    protected StartDoc(w: number, h: number): void;
    protected EndDoc(): void;
}
