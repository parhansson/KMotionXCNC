import { ModelSettings } from '../model/model.settings';
import { ModelTransformer } from './model.transformer';
export declare class Pdf2SvgTransformer implements ModelTransformer<ArrayBuffer, SVGElement> {
    private transformerSettings;
    constructor(transformerSettings: ModelSettings);
    transform(source: ArrayBuffer): Promise<SVGElement>;
    private logSvg;
}
