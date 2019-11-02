import { Observer } from 'rxjs';
export declare abstract class ModelTransformer<Source, Target> {
    inputMime: string[];
    outputMime: string;
    name: string;
    abstract execute(source: Source, targetObserver: Observer<Target>): void;
}
