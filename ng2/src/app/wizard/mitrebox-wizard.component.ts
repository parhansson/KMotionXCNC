import { Component, Inject, Input, Output, ViewChild, ElementRef } from '@angular/core'
import { IGM, IGMDriver, MitreBox } from 'camx'
import { SvgPreviewComponent } from './svg-preview.component'

@Component({
  selector: 'mitre-box-wizard',
  templateUrl: './mitrebox-wizard.component.html'
})
export class MitreBoxWizardComponent {
  box: MitreBox

  @ViewChild(SvgPreviewComponent, { static: false })
  private previewContainer: SvgPreviewComponent

  constructor() {
    this.box = new MitreBox(70, 70, 30, 3)
  }

  render() {
    const svg = this.toSVG(this.box.generate())
    this.previewContainer.render(svg)
  }

  toSVG(model: IGM) {
    let svg = ''
    const res = 1
    const driver = new IGMDriver(model)
    const paths = driver.allObjectsFlat
    IGMDriver.updateBounds(paths)
    const bounds = driver.getMaxBounds(paths)
    const w = bounds.x2
    const h = bounds.y2
    const dpi = 72 //output DPI
    const dpiScale = dpi / 25.4 // assuming input model in mm not in inches
    svg += '<?xml version="1.0" standalone="no"?>\r\n'
    svg += '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\r\n'
    svg += '<svg width="' + w / res + 'mm" height="' + h / res + 'mm" viewBox="0 0 ' + w * dpiScale + ' ' + h * dpiScale + '" xmlns="http://www.w3.org/2000/svg" version="1.1">\r\n'
    //svg += '<svg xmlns="http://www.w3.org/2000/svg" version="1.0" width="' + w + '" height="' + h + '">\r\n'

    for (const part of driver.allObjectsFlat) {
      //TODO rescaling after calculating bounds???
      IGMDriver.scale(part, dpiScale)

      const points: string[] = []
      points.push('M')
      const p0 = part.vectors[0]

      points.push(p0.x + '')
      points.push(p0.y + '')
      points.push('L')
      for (const vec of part.vectors) {
        points.push(vec.x + '')
        points.push(vec.y + '')
        //points.push(vec.x + ',' + vec.y)
      }
      //svg += points.join(' ')

      svg += `<path d="${points.join(' ')} Z" fill="steelblue" vector-effect="non-scaling-stroke" stroke="black" stroke-width="0.2" />\r\n`
    }

    svg += ('</svg>\r\n')
    return svg
  }
}