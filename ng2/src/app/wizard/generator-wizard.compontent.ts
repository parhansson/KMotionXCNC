import { Component, Inject, Input, Output, ViewChild, ElementRef } from '@angular/core'
import { SvgPreviewComponent } from './svg-preview.component'
import { InputBase } from '@kmx/form/input-base'
import { ModelGenerator } from 'camx'



@Component({
  selector: 'generator-wizard',
  template: `
<div>
  <div class="col d-flex">
    <kmx-dynamic-form [inputs]="inputs" [headerLabel]="header" (apply)="render($event)"></kmx-dynamic-form>
    <svg-preview></svg-preview>
  </div>
</div>
  `
})
export class GeneratorWizardComponent {

  @Input() generator: ModelGenerator<any>
  @Input() header:string
  @ViewChild(SvgPreviewComponent, { static: false })
  private previewContainer: SvgPreviewComponent

  inputs: Array<InputBase<any>>
  constructor() {
  }
  
  ngOnInit() {
    this.inputs = this.generator.requiredInput().map(i => {
      return new InputBase(i.controlType, i)
    })
  }


  async render(values) {
    const svg = await this.generator.generateSVG(values)
    this.previewContainer.render(svg)
  }
}