import { Component, Inject } from '@angular/core'
import { ModelSettings, PDFModelSettings, SVGModelSettings, IGMModelSettings } from 'camx'
import { ModelSettingsService } from '../model/model.settings.service'
import { InputBase } from '@kmx/form/input-base'

@Component({
  selector: 'transformer-settings',
  templateUrl: 'transformer-settings.html'
})
export class TransformerSettingsComponent {
  transformerSettings: ModelSettings
  pdfSettings: Array<InputBase<PDFModelSettings>>
  svgSettings: Array<InputBase<SVGModelSettings>>
  igmSettings: Array<InputBase<IGMModelSettings>>
  constructor(private modelSettingsService: ModelSettingsService) {
    this.transformerSettings = modelSettingsService.settings
    this.pdfSettings = [

      new InputBase('text', {
        type: 'number',
        name: 'page',
        label: 'Pdf import page number',
        value: this.transformerSettings.pdf.page,
        required: true,
        min: 1,
        order: 1
      }), new InputBase('text', {
        type: 'number',
        name: 'rotate',
        label: 'Rotation degrees',
        value: this.transformerSettings.pdf.rotate,
        required: true,
        min: 0,
        max: 360,
        order: 2
      }), new InputBase('text', {
        type: 'number',
        name: 'scale',
        label: 'Scale',
        value: this.transformerSettings.pdf.scale,
        required: true,
        min: 0,
        order: 3
      })
    ]
    this.svgSettings = [
      new InputBase('text', {
        type: 'number',
        name: 'dpi',
        label: 'SVG DPI',
        value: this.transformerSettings.svg.dpi,
        required: true,
        min: 0,
        max: 360,
        order: 1
      }),
      new InputBase('bool', {
        type: 'checkbox',
        name: 'renderText',
        label: 'Vectorize text',
        value: this.transformerSettings.svg.renderText,
        order: 2
      })
    ]
    this.igmSettings = [
      new InputBase('text', {
        type: 'number',
        name: 'fractionalDigits',
        label: 'Fractional digits (resolution)',
        value: this.transformerSettings.igm.fractionalDigits,
        required: true,
        min: 0,
        max: 10,
        order: 1
      }),
      new InputBase('text', {
        type: 'text',
        name: 'initCode',
        label: 'Init code)',
        value: this.transformerSettings.igm.initCode,
        required: false,
        min: 0,
        max: 10,
        order: 2
      }),
      new InputBase('text', {
        type: 'number',
        name: 'feedRate',
        label: 'Feed rate)',
        value: this.transformerSettings.igm.feedRate,
        required: true,
        min: 1,
        max: 10,
        order: 3
      }),      
      new InputBase('text', {
        type: 'number',
        name: 'scale',
        label: 'Scale on import',
        value: this.transformerSettings.igm.scale,
        required: true,
        min: 0,
        order: 4
      }),      
      new InputBase('bool', {
        type: 'checkbox',
        name: 'removeOutline',
        label: 'Remove outline (not complete)',
        value: this.transformerSettings.igm.removeOutline,
        order: 10
      }),      
      new InputBase('bool', {
        type: 'checkbox',
        name: 'removeDuplicates',
        label: 'Remove duplicates (not complete, might remove too much)',
        value: this.transformerSettings.igm.removeDuplicates,
        order: 11
      }),      
      new InputBase('bool', {
        type: 'checkbox',
        name: 'removeSingularites',
        label: 'Remove single points',
        value: this.transformerSettings.igm.removeSingularites,
        order: 12
      }),      
      new InputBase('bool', {
        type: 'checkbox',
        name: 'translateToOrigo',
        label: 'Move to origin',
        value: this.transformerSettings.igm.translateToOrigo,
        order: 13
      })
    ]
  }
  pdfChange(values){
    console.log(this.transformerSettings.pdf)
    Object.assign(this.transformerSettings.pdf, values)
    console.log(this.transformerSettings.pdf)
  }
  svgChange(values){
    Object.assign(this.transformerSettings.svg, values)
  }
  igmChange(values){
    Object.assign(this.transformerSettings.igm, values)
  }
}