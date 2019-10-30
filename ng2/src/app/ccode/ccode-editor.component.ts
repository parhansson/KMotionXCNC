import { Component, Inject, ViewChild } from '@angular/core'
import { AceEditorComponent } from '../editor'
import { FileResource, FileStoreToken, FileStore, DefaultFileStore } from '../resources'


@Component({
  selector: 'ccode-editor',
  template: `
    <code-editor mode="c_cpp" >
      <div buttons>
        <span class="btn btn-primary fa fa-link" title="Compile" (click)="onCompile()"></span>
        <span class="btn btn-primary fa fa-exchange" title="Compile and Execute" (click)="onCompile()"></span>
      </div>
    </code-editor>`,
  styles : [
  `
  :host {
    display: block;
  }`,
  `
  code-editor {
    display: block;
    height: 80vh;
  }`,
],
  viewProviders: [
    { provide: FileStoreToken, useClass: DefaultFileStore }
  ]
})
export class CCodeEditorComponent {
  @ViewChild(AceEditorComponent, {static:false})
  editorComponent: AceEditorComponent

  constructor() { }

  ngAfterViewInit() {
    this.editorComponent.onFile(new FileResource('./settings/c-programs'))
  }
  onCompile() {
    console.warn('Compile not implemented')
  }
}