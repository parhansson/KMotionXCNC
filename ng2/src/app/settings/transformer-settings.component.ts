import { Component, Inject } from '@angular/core'
import { ModelSettings, PDFModelSettings, SVGModelSettings, IGMModelSettings, DXFModelSettings } from 'camx'
import { ModelSettingsService } from '../model/model.settings.service'
import { InputBase } from '@kmx/form/input-base'

@Component({
  selector: 'transformer-settings',
  templateUrl: 'transformer-settings.html'
})
export class TransformerSettingsComponent {
  transformerSettings: ModelSettings
  pdfSettings: InputBase<PDFModelSettings>[]
  svgSettings: InputBase<SVGModelSettings>[]
  igmSettings: InputBase<IGMModelSettings>[]
  dxfSettings: InputBase<DXFModelSettings>[]
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
    ],
    this.dxfSettings = [
      new InputBase('bool', {
        type: 'checkbox',
        name: 'includeDimension',
        label: 'Include dimensions from drawing',
        value: this.transformerSettings.dxf.includeDimension,
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
      }),      
      new InputBase('bool', {
        type: 'checkbox',
        name: 'calculateShortestPath',
        label: 'Calculate shortest path',
        value: this.transformerSettings.igm.calculateShortestPath,
        order: 14
      }),
      new InputBase('bool', {
        type: 'checkbox',
        name: 'joinAdjacent',
        label: 'Join adjacent lines',
        value: this.transformerSettings.igm.joinAdjacent,
        order: 14
      }),
      new InputBase('bool', {
        type: 'checkbox',
        name: 'multipass',
        label: 'Multipass',
        value: this.transformerSettings.igm.multipass,
        order: 16
      }),
      new InputBase('text', {
        type: 'number',
        name: 'materialThickness',
        label: 'Multipass material thickness',
        value: this.transformerSettings.igm.materialThickness,
        required: false,
        min: 0,
        order: 17
      }),       
      new InputBase('text', {
        type: 'number',
        name: 'passes',
        label: 'Multipass number of passes',
        value: this.transformerSettings.igm.passes,
        required: false,
        min: 1,
        order: 18
      }),   
    ]
  }
  dxfChange(values){
    Object.assign(this.transformerSettings.dxf, values)
  }
  pdfChange(values){
    Object.assign(this.transformerSettings.pdf, values)
  }
  svgChange(values){
    Object.assign(this.transformerSettings.svg, values)
  }
  igmChange(values){
    Object.assign(this.transformerSettings.igm, values)
  }
}