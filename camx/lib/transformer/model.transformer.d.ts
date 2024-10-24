export interface ModelTransformer<Source, Target> {
    transform(source: Source): Promise<Target>;
}
