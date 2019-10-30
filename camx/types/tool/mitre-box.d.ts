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
    protected PolyPoint(x: any, y: any): void;
    protected PolyEnd(): void;
    protected StartDoc(w: any, h: any): void;
    protected EndDoc(): void;
}
