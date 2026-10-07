import * as opentype from 'opentype.js';
export declare class FontLoaderService {
    private static fontMap;
    hasFont(fontName: string): boolean;
    getFont(fontName: string): Promise<opentype.Font>;
    preloadFont(fontUrl: string, fontName: string): Promise<opentype.Font>;
    private loadFont;
}
