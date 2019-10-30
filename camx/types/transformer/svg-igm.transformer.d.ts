import { Observer } from 'rxjs';
import { IGM } from '../model/igm';
import { ModelTransformer } from './model.transformer';
import { SVGModelSettings } from '../model/model.settings';
export declare class Svg2IgmTransformer extends ModelTransformer<SVGElement, IGM> {
    private settings;
    constructor(settings: SVGModelSettings);
    execute(svgRootElement: SVGElement, targetObserver: Observer<IGM>): void;
    private makeModel;
    private makeShape;
}
