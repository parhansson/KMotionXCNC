import { IGM, GCodeSource } from '../model/igm';
import { IGMModelSettings } from '../model/model.settings';
import { ModelTransformer } from './model.transformer';
export declare class Igm2GcodeTransformer implements ModelTransformer<IGM, GCodeSource> {
    private settings;
    name: 'IGM to G-Code';
    inputMime: ['application/x-kmx-gcode'];
    outputMime: 'application/x-gcode';
    constructor(settings: IGMModelSettings);
    transform(igm: IGM): Promise<GCodeSource>;
    /**
     * Cut material in several passes. Do reverse passes if shape is not closed
     */
    private passCut;
    private toGCODE;
    private scaleNoDPI;
    private describe;
    private format;
}
