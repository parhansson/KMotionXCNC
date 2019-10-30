import { Component, ViewChild, SkipSelf, Inject , AfterViewInit} from '@angular/core'
import { FileResource, Payload, FileServiceToken, IFileBackend, FileStoreToken, FileStore } from '../resources'
import { AceEditorComponent} from '../editor'
import { TransformingFileStore } from '../model/transforming-file-store.service'
import { SocketService } from '../backend/socket.service'
import { BackendService } from '../backend/backend.service'

@Component({
  selector: 'gcode-editor',
  template: `
        <code-editor mode="gcode"></code-editor>
  `,
  styles : [
    `
    :host {
      display: block;
      height:340px;
    }`,
    `
    code-editor {
      display: block;
      width:400px;
      height:300px;
    }`,
  ],  
  viewProviders: [
    { provide: FileStoreToken, useClass: TransformingFileStore }
  ]
})
export class GCodeEditorComponent implements AfterViewInit{
  @ViewChild(AceEditorComponent, {static: false})
  editorComponent: AceEditorComponent

  constructor( 
    @Inject(FileStoreToken) private fileStore: TransformingFileStore,
    @Inject(FileServiceToken) private fileBackend: BackendService,
    private socketService: SocketService) {

    }
    
    
    ngAfterViewInit() {
      this.editorComponent.onFile(new FileResource('./gcode'))
      //this.editorComponent.onContentChange()
      this.socketService.status.subscribe(status => {
        // if(status.interpreting){
          // need a way to turn this on and off
          //this.editorComponent.selectRow(status.currentLine)
    
        // }
      })
      this.socketService.gcodeFileSubject.subscribe(gcodeFile => {
        this.editorComponent.resource = gcodeFile
        const subscription = this.fileBackend.loadFile(gcodeFile.canonical).subscribe(
          payload => {
            this.fileStore.payloadSubject.next(payload)
        },
        null,
        () => subscription.unsubscribe()
      )
    })
  }

}