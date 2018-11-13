import { Component, Input, Output, EventEmitter, Inject } from '@angular/core'
import { FileResource } from './file-resource'
import { IFileBackend, FileServiceToken, FileEntry } from './file-backend'
import { Payload } from './payload'

@Component({
  selector: 'file-dialog',
  template: `
  <div class="modal" [style.display]="modalDisplay">
      <div class="modal-dialog">
        <div class="modal-content">       
          <div class="modal-header">
            <a class="close" (click)="hide()">&times;</a>
            <h4>Open file</h4>
          </div>
          <div class="modal-body" file-dropzone (dropped)="setFileResource($event)">
            <file-path [resource]="resource" (changed)="listDir()" ></file-path>
            <ul class="modal-file-list">
              <li class="button" (click)="selectFile(file)" *ngFor="let file of files">{{file.name}}</li>          
            </ul>
            <p>Open file by selecting or with drag and drop to editor from desktop</p>
          </div>
          <div class="modal-footer">
            <a class="btn" (click)="hide()">Cancel</a>      
          </div>
        </div>
      </div>
      </div>
    `,
    styles : [
    `.modal-file-list {
        height: 300px;
        width: 97%;
        padding: 3px;
        margin-bottom: 3px;
        border: 1px solid #79f;
        font-size: 12px;
        color: #753;
        white-space: pre;
        word-wrap: normal;
        overflow-x: scroll;
        cursor: pointer;
    }`]
})
export class FileDialogComponent {
  @Input() resource: FileResource
  @Output() selectedFile = new EventEmitter<FileResource | Payload>()

  public files: FileEntry[] = []
  public modalDisplay: string = 'none'
  private showModal: boolean = false

  constructor( @Inject(FileServiceToken) private fileBackend: IFileBackend) {

  }


  selectFile(file: FileEntry) {
    if (file.type === 4) {
      if (file.name === '..') {
        this.resource.up(1)
      } else if (file.name === '.') {
        //Do nothing, same directory
      } else {
        this.resource.append(file.name)
      }
      this.listDir()
    } else {
      this.resource.file = file.name
      this.openFile()
    }
  }

  show() {
    this.showModal = true
    this.modalDisplay = 'block'
    this.listDir()
  }
  hide() {
    this.showModal = false
    this.modalDisplay = 'none'
  }

  saveAs(content: string) {
    //TODO implement
    console.warn('Save as not yet implemented')
  }
  onPayload(payload: Payload) {
    //Dropped file
    console.log('Imported file')
    this.selectedFile.emit(payload)
  }
  public setFileResource(file: FileResource) {
    this.selectedFile.emit(file)
    this.hide()
  }
  openFile() {
    this.setFileResource(this.resource)
  }

  public listDir() {
    this.fileBackend.listDir(this.resource.dir).subscribe(
      data => {
        this.files = data.files
        this.resource.dir = data.dir
      },
      err => console.log(err)
    )

  }
}   