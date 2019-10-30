import { IGM, GCodeSource } from '../model/igm';
import { IGMModelSettings } from '../model/model.settings';
import { ModelTransformer } from './model.transformer';
import { Observer } from 'rxjs';
export declare class Igm2GcodeTransformer extends ModelTransformer<IGM, GCodeSource> {
    private settings;
    name: 'IGM to G-Code';
    inputMime: ['application/x-kmx-gcode'];
    outputMime: 'application/x-gcode';
    constructor(settings: IGMModelSettings);
    execute(igm: IGM, targetObserver: Observer<GCodeSource>): void;
    /**
     * Cut material in several passes. Do reverse passes if shape is not closed
     */
    private passCut;
    private scaleNoDPI;
    private describe;
    private format;
}
