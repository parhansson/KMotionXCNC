import { Component, Inject, Input, Output, ViewChild, ElementRef } from '@angular/core';
import { StaticTransformer } from '../model/transformers'
import { SvgEditor } from './svg-editor'

@Component({
  selector: 'svg-preview',
  templateUrl: './svg-preview.component.html'
})
export class SvgPreviewComponent {
  @ViewChild('preview')
  private previewContainer: ElementRef
  private svgEditor: SvgEditor

  constructor(private staticTransformer: StaticTransformer) {
    this.svgEditor = new SvgEditor();
  }

  render(svg: string | SVGElement) {

    //Open in new window
    //let blob = new Blob([svg], { type: 'image/svg+xml' });
    //window.open(window.URL.createObjectURL(blob));
    let doc: SVGElement
    if (typeof svg  === 'string') {
       doc = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement as any as SVGElement;
    } else {
      doc = svg
    }

    const node = this.previewContainer.nativeElement as Element
    while (node.firstChild) {
      node.removeChild(node.firstChild)
    }

    this.svgEditor.augment(doc)
    node.appendChild(doc)

    //TODO only content of currently loaded gcode file is changed not the file name
    //this.staticTransformer.transform('image/svg+xml', svg)
  }


}