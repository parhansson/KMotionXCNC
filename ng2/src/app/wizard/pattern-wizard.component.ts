import { Component, Inject, Input, Output, ViewChild, ElementRef } from '@angular/core'
import { IGM, IgmObject, IGMDriver } from 'camx'
import { SvgPreviewComponent } from './svg-preview.component'


@Component({
  selector: 'pattern-wizard',
  template: `
<div>
  <div class="form-group">
      <label>Size</label>
      <div class="input-group">
        <input class="form-control" [(ngModel)]="rows" type="number" min=1 max=1000 placeholder="Box depth Z">
        <span class="input-group-addon">pt</span>
      </div>

  </div>
  <div class="form-group">
      <label>Size</label>
      <div class="input-group">
        <input class="form-control" [(ngModel)]="columns" type="number" min=1 max=1000 placeholder="Box depth Z">
        <span class="input-group-addon">pt</span>
      </div>
  </div>
  <button (click)="render()">Create</button>
    <svg-preview></svg-preview>
</div>
  `
})
export class PatternWizardComponent {

  @ViewChild(SvgPreviewComponent, { static: false })
  private previewContainer: SvgPreviewComponent

  rows: number = 2
  columns: number = 4
  rowSpacing: number = 2
  colSpacing: number = 2

  constructor() {

  }
  private rect(width, height) {
    const shape = IGMDriver.newIgmObject()
    shape.vectors.push(IGMDriver.newGCodeVector(0, 0))
    shape.vectors.push(IGMDriver.newGCodeVector(width, 0))
    shape.vectors.push(IGMDriver.newGCodeVector(width, height))
    shape.vectors.push(IGMDriver.newGCodeVector(0, height))
    shape.vectors.push(IGMDriver.newGCodeVector(0, 0))
    return shape
  }

  render() {
    /*
G90
G21
(M100 P1200 Q100)
(F200)
M100 P2000 Q100
F120
M5 (laser off)
G0 X0 Y0 Z3
M3 (laser on)
G1 X53 Y0
G1 X53 Y38
G1 X0 Y38
G1 X0 Y0
M5 (laser off)
G0 X4.75 Y13.25
M3 (laser on)
G1 X48.25 Y13.25
G1 X48.25 Y24.75
G1 X4.75 Y24.75
G1 X4.75 Y13.25
M5 (laser off)
G0 X0 Y0 Z0
M2
    // */
    const shape = this.rect(53, 38)
    const shape2 = this.rect(43.5, 11.5)
    IGMDriver.translate(shape2, IGMDriver.newGCodeVector(4.75, 13.25))

    // const shape = this.rect(38,53)
    // const shape2 = this.rect(11.5,43.5)
    // shape2.translate(new GCodeVector(13.25,4.75))


    const igm = new IGM()
    const driver = new IGMDriver(igm)
    IGMDriver.updateBounds([shape, shape2])
    const width = shape.bounds.width()
    const height = shape.bounds.height()

    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.columns; col++) {
        const translate = IGMDriver.newGCodeVector(col * (width + this.colSpacing), row * (height + this.rowSpacing))
        driver.addToLayerObject('one', IGMDriver.translate(IGMDriver.clone(shape), translate))
        driver.addToLayerObject('one', IGMDriver.translate(IGMDriver.clone(shape2), translate))
      }
    }
    const svg = this.toSVG(igm)
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


    for (const part of driver.allObjectsFlat) {
      //TODO rescaling after calculating bounds???
      IGMDriver.scale(part, dpiScale)
      svg += ('<polyline points="')
      const points = []
      for (const vec of part.vectors) {
        points.push(vec.x + ',' + vec.y)
      }
      svg += points.join(' ')

      svg += ('" fill="none" stroke="black" stroke-width="0.2" />\r\n')
    }

    svg += ('</svg>\r\n')
    return svg
  }
}