import { ModelGenerator } from './model-generator';
import { GeneratorInput } from './generator-input';
declare type Point = [number, number];
export interface JigsawGeneratorInput {
    rows: number;
    columns: number;
    showControlPoints: boolean;
    width: number;
    height: number;
    shapeOffsetName: string;
}
export declare class JigsawGenerator implements ModelGenerator<JigsawGeneratorInput> {
    private rows;
    private columns;
    private showControlPoints;
    private width;
    private height;
    private shapeOffsetName;
    constructor();
    private setValues;
    requiredInput(): GeneratorInput<JigsawGeneratorInput>[];
    generate(values: any): Promise<never>;
    generateSVG(values: any): Promise<string>;
    private edgeDistributions;
    private buildDistributions;
    private transposePoint;
    private offsetPoint;
    private offsetPoints;
    private buildPieces;
    private edgePathdata;
    private piecePathData;
    private buildpoints;
    private buildPiecePaths;
    svg: {
        docStart: string;
        openTag: string;
        styletag: string;
        closeTag: string;
        path: (pathData: string) => string;
        circle: (point: Point) => string;
    };
}
export {};
