import { ModelGenerator } from './model-generator';
import { GeneratorInput } from './generator-input';
import { IGM } from '../model';
export interface ChipherWheelGeneratorInput {
    size: number;
    letters: string;
    dial: boolean;
}
export declare class ChipherWheelGenerator implements ModelGenerator<ChipherWheelGeneratorInput> {
    requiredInput(): GeneratorInput<ChipherWheelGeneratorInput>[];
    generate(values: ChipherWheelGeneratorInput): Promise<IGM>;
    generateSVG(values: ChipherWheelGeneratorInput): Promise<string>;
    polarToCartesian(centerX: any, centerY: any, radius: any, angleInDegrees: any): {
        x: any;
        y: any;
    };
    describeArc(x: any, y: any, radius: number, startAngle: any, endAngle: any, lineto?: boolean): string;
    toSVG(radius: number, letters: string, dialRing: boolean): string;
}
