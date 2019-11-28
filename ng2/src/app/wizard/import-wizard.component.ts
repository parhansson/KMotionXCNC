import { Component, Inject, Input, Output, ViewChild, ElementRef } from '@angular/core'
import { SvgPreviewComponent } from './svg-preview.component'
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
import { IGM, LayerStatus, IGMDriver, igm2SVG, Pdf2SvgTransformer, Igm2GcodeTransformer, Svg2IgmTransformer, Dxf2IgmTransformer, Gcode2IgmTransformer } from 'camx'
import { InputBase } from '@kmx/form/input-base'
import { ModelSettingsService } from '@kmx/model/model.settings.service'

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

  @ViewChild(SvgPreviewComponent, { static: false })
  private previewContainer: SvgPreviewComponent

  //not used?
  @ViewChild(FileDialogComponent, { static: false })
  private resourceComponent: FileDialogComponent

  private igm: IGM = null

  constructor(@Inject(FileStoreToken) private fileStore: FileStore,
    private transformingFileStore: TransformingFileStore,
    private staticTransformer: StaticTransformer,
    private modelSettings: ModelSettingsService) {
    this.resource = new FileResource('')

    this.subscribe(this.fileStore)
    this.subscribe(this.transformingFileStore)
    staticTransformer.svgSubject.subscribe(
      data => this.renderSvg(data),
      err => console.error(err))

    staticTransformer.igmSubject.subscribe(
      data => this.showLayers(data),
      err => console.error(err))
  }

  layerInputs: Array<InputBase<any>> = []

  private showLayers(igm: IGM) {
    this.igm = igm
    this.layerInputs = []
    console.log(igm.layers)
    const layerStatus: LayerStatus =  {}
    for (const layerName in this.igm.layers) {
      // important check that this is objects own property 
      // not from prototype prop inherited
      if (this.igm.layers.hasOwnProperty(layerName)) {
        layerStatus[layerName] = true
        const layer = this.igm.layers[layerName]
        this.layerInputs.push(new InputBase('bool', {
          type: 'checkbox',
          name: layerName,
          label: 'Include layer "' + layerName+ '"',
          value: layer.visible
        }))
      }
    }
    this.selectLayers(layerStatus)
    console.log(this.layerInputs)
  }

  selectLayers(layers:LayerStatus) {
    new IGMDriver(this.igm).setLayerStatus(layers)
    console.log(layers)
    //preview as svg
    this.previewContainer.render(igm2SVG(this.igm))
  }

  transformGCode() {
    //TODO only content of currently loaded gcode file is changed not the file name
    this.staticTransformer.transform('igm/model', this.igm)
    
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
    console.log('onContentChange', change)
    // TODO Gcode need to be aware of this in order update 3d view
    this.dirty = true
  }

  onSave() {
    this.fileStore.store(this.resource.canonical, this.textContent)
    this.dirty = false
  }

  onFileRaw(file: FileResource | Payload) {
    if (file instanceof FileResource) {
      this.resource = file
    } else {
      //Use imported name
      this.resource.canonical = file.name
    }
    //Selected in file dialog or drop imported file
    //load() should be responsible for returning file resource.
    //then imported files can be saved and get a real name
    this.fileStore.load(file)

  }

  onFileTransform(file: FileResource | Payload) {
    if (file instanceof FileResource) {
      this.resource = file
    } else {
      //Use imported name
      const payload = file
      this.staticTransformer.transform(payload.contentType || payload.name, payload.arrayBuffer())
      this.resource.canonical = file.name
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
