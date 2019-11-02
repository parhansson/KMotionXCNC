import { Observer } from 'rxjs';
import { ModelSettings } from '../model/model.settings';
import { ModelTransformer } from './model.transformer';
export declare class Pdf2SvgTransformer extends ModelTransformer<ArrayBuffer, SVGElement> {
    private transformerSettings;
    constructor(transformerSettings: ModelSettings);
    execute(source: ArrayBuffer, targetObserver: Observer<SVGElement>): void;
    private logSvg;
    createContainer(pageNum: number, width: number, height: number, parentElement: HTMLElement): HTMLDivElement;
    createAnchor(pageNum: number): HTMLAnchorElement;
}
