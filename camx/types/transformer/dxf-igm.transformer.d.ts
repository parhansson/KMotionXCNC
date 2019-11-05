import { Observer } from 'rxjs';
import { ModelTransformer } from './model.transformer';
import { IGM } from '../model/igm';
export declare class Dxf2IgmTransformer extends ModelTransformer<ArrayBuffer | string, IGM> {
    constructor();
    execute(source: ArrayBuffer | string, targetObserver: Observer<IGM>): void;
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
