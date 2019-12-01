import { IGM } from '../model/igm';
import { ModelTransformer } from './model.transformer';
import { SVGModelSettings } from '../model/model.settings';
export declare class Svg2IgmTransformer implements ModelTransformer<SVGElement, IGM> {
    private settings;
    constructor(settings: SVGModelSettings);
    transform(svgRootElement: SVGElement): Promise<IGM>;
    private makeModel;
    private makeShape;
}
