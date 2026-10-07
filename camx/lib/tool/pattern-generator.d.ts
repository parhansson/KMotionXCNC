import { ModelGenerator } from './model-generator';
import { GeneratorInput } from './generator-input';
import { IGM } from '../model';
export interface PatternGeneratorInput {
    rows: number;
    columns: number;
    rowSpacing: number;
    colSpacing: number;
}
export declare class PatternGenerator implements ModelGenerator<PatternGeneratorInput> {
    constructor();
    requiredInput(): GeneratorInput<PatternGeneratorInput>[];
    private rect;
    generateSVG(values: PatternGeneratorInput): Promise<string>;
    generate(values: PatternGeneratorInput): Promise<IGM>;
}
