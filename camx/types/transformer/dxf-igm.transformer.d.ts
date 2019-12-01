import { ModelTransformer } from './model.transformer';
import { IGM } from '../model/igm';
import { DXFModelSettings } from '../model';
export declare class Dxf2IgmTransformer implements ModelTransformer<ArrayBuffer | string, IGM> {
    private settings;
    private driver;
    constructor(settings: DXFModelSettings);
    transform(source: ArrayBuffer | string): Promise<IGM>;
    private isArc;
    private isLine;
    private isDimension;
    private isSpline;
    private isEllipse;
    private doEntity;
    private scale;
    private doArc;
    private doEllipse;
    private doLine;
    private doSpline;
    private doDimension;
}
