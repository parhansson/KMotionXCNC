
import { FontLoaderService } from '../util'
import { ModelGenerator } from './model-generator'
import { GeneratorInput } from './generator-input'

export interface TextPathGeneratorInput {
  fontName: string
  fontSize: number
  text: string

}

export class TextPathGenerator implements ModelGenerator<TextPathGeneratorInput> {
  requiredInput() {
    const inputs: Array<GeneratorInput<TextPathGeneratorInput>> = [
      {
        controlType: 'selection',
        type: 'text',
        name: 'fontName',
        label: 'Font',
        options: [
          { key: '/settings/arial.ttf', value: 'Arial' },
          { key: 'unknown', value: 'Unknown' },
        ],
        value: '/settings/arial.ttf',
        required: true,
        order: 3
      }, {
        controlType: 'text',
        type: 'number',
        name: 'fontSize',
        label: 'Font size',
        append: 'pt',
        value: 12,
        required: true,
        order: 1
      }, {
        controlType: 'text',
        type: 'text',
        name: 'text',
        label: 'Text to render',
        placeholder: 'Enter text',
        required: true,
        order: 1
      }

    ]
    return inputs
  }
  generate(values: TextPathGeneratorInput) {
    return Promise.reject(new Error('Method not implemented.'))
  }
  generateSVG(values: TextPathGeneratorInput) {
    return getTextSVG(values.text, values.fontName, values.fontSize)
  }
}
export async function getTextSVG(text: string,
  fontName: string,
  fontSize: number = 12): Promise<string> {

  const fontLoader = new FontLoaderService()
  const font = await fontLoader.getFont(fontName)

  const path = font.getPath(text, 0, 0, fontSize)
  const dPath = path.toPathData(undefined)
  const svg = toSVG(dPath, fontSize)
  return svg
}

function toSVG(dPath: string, fontSize: number): string {

  let svg = ''

  const res = 1
  // const paths = model.alllayers
  // model.setBounds(paths);
  // const bounds = model.getMaxBounds(paths)
  // const w = bounds.x2
  // const h = bounds.y2

  const w = 100
  const h = 100
  const dpi = 72 //output DPI
  const dpiScale = dpi / 25.4 // assuming input model in mm not in inches
  svg += '<?xml version="1.0" standalone="no"?>\r\n'
  svg += '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\r\n'
  svg += '<svg width="' + w / res + 'mm" height="' + h / res + 'mm" viewBox="0 0 ' + w * dpiScale + ' ' + h * dpiScale + '" xmlns="http://www.w3.org/2000/svg" version="1.1">\r\n'
  svg += '<g transform="matrix(1, 0, 0, 1, 0, ' + fontSize + ')" fill="steelblue" stroke="black" stroke-width="0.1">\r\n'
  svg += `<path d="${dPath}"/>`
  svg += ('\r\n</g>')
  svg += ('</svg>\r\n')
  console.log('svg', svg)
  return svg
}