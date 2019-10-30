import { Observer } from 'rxjs';
import { ModelTransformer } from './model.transformer';
import { IGM, IgmObject } from '../model/igm';
export declare class Dxf2IgmTransformer extends ModelTransformer<ArrayBuffer | string, IGM> {
    constructor();
    execute(source: ArrayBuffer | string, targetObserver: Observer<IGM>): void;
    private isArc;
    private isLine;
    private isDimension;
    private isSpline;
    private isEllipse;
    doEntity(entity: DxfParser.Entity, data: DxfParser.DXFDocument): IgmObject[];
    scale(shape: IgmObject, dxf: DxfParser.DXFDocument): IgmObject;
    doArc(entity: DxfParser.EntityARC | DxfParser.EntityCIRCLE, dxf: DxfParser.DXFDocument): IgmObject;
    doEllipse(entity: DxfParser.EntityELLIPSE, dxf: DxfParser.DXFDocument): IgmObject;
    doLine(entity: DxfParser.EntityLINE | DxfParser.EntityLWPOLYLINE | DxfParser.EntityPOLYLINE, dxf: DxfParser.DXFDocument): IgmObject;
    doSpline(entity: DxfParser.EntitySPLINE, dxf: DxfParser.DXFDocument): IgmObject;
    doDimension(entity: DxfParser.EntityDIMENSION, dxf: DxfParser.DXFDocument): IgmObject[];
}
