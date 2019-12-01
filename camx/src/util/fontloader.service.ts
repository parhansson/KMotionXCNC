import * as opentype from 'opentype.js'

export class FontLoaderService {
  private static fontMap: { [key: string]: opentype.Font } = {}

  hasFont(fontName: string): boolean {
    const hasFont = FontLoaderService.fontMap[fontName] !== undefined
    if (!hasFont) {
      console.log('Unable to load font ' + fontName)
    }
    return hasFont
  }

  async getFont(fontName: string) {
    //console.log('Get font ' + fontName)
    const cachedFont = FontLoaderService.fontMap[fontName]
    if (cachedFont) {
      return cachedFont
    }
    console.log(`Loading font ${fontName}`)
    return this.loadFont(fontName).then(loadedFont => FontLoaderService.fontMap[fontName] = loadedFont)
  }
  async preloadFont(fontUrl: string, fontName: string): Promise<opentype.Font> {
    return this.loadFont(fontUrl).then(loadedFont => FontLoaderService.fontMap[fontName] = loadedFont)
  }
  private async loadFont(fontUrl: string): Promise<opentype.Font> {
    return new Promise<opentype.Font>((resolve, reject) => {
      opentype.load(fontUrl, (err, font) => {
        if (err) {
          console.log(`Failed to load font ${fontUrl}`)
          reject('Could not load font: ' + err)
        } else {
          resolve(font)
        }
      })
    })
  }
}