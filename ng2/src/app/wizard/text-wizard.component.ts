import { Component, ViewChild } from '@angular/core'
import { SvgPreviewComponent } from './svg-preview.component'
import { getTextSVG } from 'camx'

@Component({
  selector: 'text-wizard',
  templateUrl: './text-wizard.component.html'
})
export class TextWizardComponent {
  text: string
  fontName: string = '/settings/arial.ttf'
  fontSize: number = 12
  font: opentype.Font

  @ViewChild(SvgPreviewComponent, { static: false })
  private previewContainer: SvgPreviewComponent

  constructor() {

  }

  async render() {
    const svg = await getTextSVG(this.text, this.fontName, this.fontSize)
    this.previewContainer.render(svg)
  }

}