import { Component, Inject, Input, Output, ViewChild, ElementRef } from '@angular/core';
import { IGM } from '../model/IGM'
import { SvgPreviewComponent } from './svg-preview.component'
import * as opentype from 'opentype.js'

@Component({
  selector: 'text-wizard',
  templateUrl: './text-wizard.component.html'
})
export class TextWizardComponent {
  text: string
  fontName: string
  fontSize: number = 12
  font: opentype.Font

  @ViewChild(SvgPreviewComponent)
  private previewContainer: SvgPreviewComponent

  constructor() {
    opentype.load('/settings/RawengulkPcs.otf', (err, font) => {
      if (err) {
        alert('Could not load font: ' + err);
      } else {
        this.font = font
      }
    });
  }

  render() {

    let path = this.font.getPath(this.text, 0, 0, this.fontSize, { kerning: true })
    let dPath = path.toPathData(undefined)

    let svg = this.toSVG(path.toSVG(undefined));

    this.previewContainer.render(svg)
  }

  toSVG(path: string) {
    
    let svg = ''

    const res = 1;
    // const paths = model.alllayers
    // model.setBounds(paths);
    // const bounds = model.getMaxBounds(paths)
    // const w = bounds.x2
    // const h = bounds.y2
    
    const w = 100
    const h = 100
    const dpi = 72 //output DPI
    const dpiScale = dpi / 25.4 // assuming input model in mm not in inches
    svg += '<?xml version="1.0" standalone="no"?>\r\n';
    svg += '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\r\n';
    svg += '<svg width="' + w / res + 'mm" height="' + h / res + 'mm" viewBox="0 0 ' + w * dpiScale + ' ' + h * dpiScale + '" xmlns="http://www.w3.org/2000/svg" version="1.1">\r\n';
    //svg += '<g transform="translate(0,'+this.fontSize+')">\r\n'
    //svg += '<g >\r\n'
    svg += '<g class="draggable" transform="matrix(1, 0, 0, 1, 0, '+this.fontSize+')" fill="none" stroke="black" stroke-width="0.1">\r\n'

    // svg += '<svg width="150mm" height="150mm" viewBox="-280 -280 280 280" xmlns="http://www.w3.org/2000/svg" version="1.1">\r\n'
    // svg += '<g fill="none" stroke="black" stroke-width="0.2" transform="translate(-30,-40) scale(10)">\r\n'
    svg += path
    //svg += ('\r\n</g>');
    svg += ('\r\n</g>');
    svg += ('</svg>\r\n');
    console.log('svg', svg);
    return svg
  }
}