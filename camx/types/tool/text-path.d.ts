import { ModelGenerator } from './model-generator';
import { GeneratorInput } from './generator-input';
export interface TextPathGeneratorInput {
    fontName: string;
    fontSize: number;
    text: string;
}
export declare class TextPathGenerator implements ModelGenerator<TextPathGeneratorInput> {
    requiredInput(): GeneratorInput<TextPathGeneratorInput>[];
    generate(values: TextPathGeneratorInput): Promise<never>;
    generateSVG(values: TextPathGeneratorInput): Promise<string>;
}
export declare function getTextSVG(text: string, fontName: string, fontSize?: number): Promise<string>;
