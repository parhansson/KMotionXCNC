import { IGM } from '../model/igm';
import { ModelTransformer } from './model.transformer';
import { SVGModelSettings } from '../model/model.settings';
export declare class Igm2SvgTransformer implements ModelTransformer<IGM, string> {
    private settings;
    constructor(settings: SVGModelSettings);
    transform(input: IGM): Promise<string>;
}
export declare function igm2SVG(model: IGM): string;
