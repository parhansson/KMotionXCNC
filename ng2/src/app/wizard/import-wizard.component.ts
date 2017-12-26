import { Component, Inject, Input, Output, ViewChild, ElementRef } from '@angular/core';
import { IGM } from '../model/IGM'
import { SvgPreviewComponent } from './svg-preview.component'
import { KMXUtil } from '../util/kmxutil'
import { StaticTransformer } from '../model/transformers'
import {
  //  DropZoneDirective,
  //FilePathComponent,
  //  IFileBackend,
  //  FileServiceToken,
  FileDialogComponent,
  FileResource,
  Payload,
  FileStoreToken, FileStore, DefaultFileStore
} from '../resources'
import { TransformingFileStore } from '../model/transforming-file-store.service'

export interface OnFileEventHandler {
  (file: FileResource): void
}

@Component({
  selector: 'import-wizard',
  templateUrl: './import-wizard.component.html',
  styles: [`.dropzone {
      min-height:80px;
      cursor: pointer;
      border: 2px dashed #0087F7;
      border-radius: 5px;
      background: white;
  `],
  viewProviders: [
    TransformingFileStore,
    { provide: FileStoreToken, useClass: DefaultFileStore }
  ]
})
export class ImportWizardComponent {
  public dirty: boolean
  public textContent
  public resource: FileResource

  @ViewChild(SvgPreviewComponent)
  private previewContainer: SvgPreviewComponent

  @ViewChild(FileDialogComponent)
  private resourceComponent: FileDialogComponent

  constructor( @Inject(FileStoreToken) private fileStore: FileStore,
    private transformingFileStore: TransformingFileStore,
    private staticTransformer: StaticTransformer) {
    this.resource = new FileResource('')

    this.subscribe(this.fileStore)
    this.subscribe(this.transformingFileStore)
    staticTransformer.svgSubject.subscribe(
      data => this.renderSvg(data),
      err => console.error(err))

  }
  private subscribe(store: FileStore) {
    store.textSubject.subscribe((text) => {
      this.textContent = text
      this.dirty = false
    },
      err => console.error(err))
  }
  renderSvg(svg: SVGElement) {
    // let svg = this.generate()
    this.previewContainer.render(svg)
  }

  onContentChange(change: any /*AceAjax.EditorChangeEvent*/) {
    console.log('onContentChange', change);
    // TODO Gcode need to be aware of this in order update 3d view
    this.dirty = true;
  }

  onSave() {
    this.fileStore.store(this.resource.canonical, this.textContent)
    this.dirty = false;
  }

  onFileRaw(file: FileResource | Payload) {
    if (file instanceof FileResource) {
      this.resource = file;
    } else {
      //Use imported name
      this.resource.canonical = file.name;
    }
    //Selected in file dialog or drop imported file
    //load() should be responsible for returning file resource.
    //then imported files can be saved and get a real name
    this.fileStore.load(file);

  }

  onFileTransform(file: FileResource | Payload) {
    if (file instanceof FileResource) {
      this.resource = file;
    } else {
      //Use imported name
      const payload = file
      this.staticTransformer.transform(payload.contentType || payload.name, payload.arrayBuffer())
      this.resource.canonical = file.name;
    }
    //Selected in file dialog or drop imported file
    //load() should be responsible for returning file resource.
    //then imported files can be saved and get a real name

    // ---------This was here ------- 
    //this.transformingFileStore.load(file);

    // this.socketService.gcodeFileSubject.subscribe(gcodeFile => {
    //   this.editorComponent.resource = gcodeFile;
    //   if (gcodeFile.file) {
    //     let subscription = this.fileBackend.loadFile(gcodeFile.canonical).subscribe(
    //       payload => {
    //         this.fileStore.payloadSubject.next(payload)
    //       },
    //       null,
    //       () => subscription.unsubscribe()
    //     );
    //   }

    // })

  }
}
