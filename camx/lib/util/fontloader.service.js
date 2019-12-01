var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import * as opentype from 'opentype.js';
export class FontLoaderService {
    hasFont(fontName) {
        const hasFont = FontLoaderService.fontMap[fontName] !== undefined;
        if (!hasFont) {
            console.log('Unable to load font ' + fontName);
        }
        return hasFont;
    }
    getFont(fontName) {
        return __awaiter(this, void 0, void 0, function* () {
            //console.log('Get font ' + fontName)
            const cachedFont = FontLoaderService.fontMap[fontName];
            if (cachedFont) {
                return cachedFont;
            }
            console.log(`Loading font ${fontName}`);
            return this.loadFont(fontName).then(loadedFont => FontLoaderService.fontMap[fontName] = loadedFont);
        });
    }
    preloadFont(fontUrl, fontName) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.loadFont(fontUrl).then(loadedFont => FontLoaderService.fontMap[fontName] = loadedFont);
        });
    }
    loadFont(fontUrl) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                opentype.load(fontUrl, (err, font) => {
                    if (err) {
                        console.log(`Failed to load font ${fontUrl}`);
                        reject('Could not load font: ' + err);
                    }
                    else {
                        resolve(font);
                    }
                });
            });
        });
    }
}
FontLoaderService.fontMap = {};
//# sourceMappingURL=fontloader.service.js.map