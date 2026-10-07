import { IGM } from '../model/igm';
import { ModelGenerator } from './model-generator';
import { GeneratorInput } from './generator-input';
export interface MitreBoxInput {
    materialThickness: number;
    depth: number;
    width: number;
    height: number;
    lid: boolean;
}
export declare class MitreBox implements ModelGenerator<MitreBoxInput> {
    private models;
    private cut_width;
    constructor();
    requiredInput(): GeneratorInput<MitreBoxInput>[];
    generateSVG(values: MitreBoxInput): Promise<string>;
    generate(values: MitreBoxInput): Promise<IGM>;
    private MitrePanel;
    protected PolyStart(): void;
    private getLast;
    protected PolyPoint(x: number, y: number): void;
    protected PolyEnd(): void;
    protected StartDoc(w: number, h: number): void;
    protected EndDoc(): void;
}
