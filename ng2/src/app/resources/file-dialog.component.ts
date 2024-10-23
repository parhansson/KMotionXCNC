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
              <li class="button" (click)="selectFile(file)" *ngFor="let file of files">
              <b *ngIf="file.type == 4">{{file.name}}</b>
              <span *ngIf="file.type != 4">{{file.name}}</span>
              </li>          
            </ul>
            <p *ngIf="!saveMode">Open file by selecting or with drag and drop to editor from desktop</p>
            <div *ngIf="saveMode">
              <p>Select folder and enter file name</p>
              <input class="form-control" [(ngModel)]="resource.file" type="text" />
            </div>
          </div>
          <div class="modal-footer">
            <a *ngIf="saveMode" class="btn" (click)="doSave()">Save as</a>      
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
  @Output() saveAsFile = new EventEmitter<FileResource>()

  public files: FileEntry[] = []
  public modalDisplay: string = 'none'
  private showModal: boolean = false
  public saveMode: boolean = false

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
      if(this.saveMode){

      } else {
        this.doOpenFile()
      }
    }
  }

  openDialog(saveMode:boolean){
    this.saveMode = saveMode
    this.showModal = true
    this.modalDisplay = 'block'
    this.listDir()
  }
  hide() {
    this.showModal = false
    this.modalDisplay = 'none'
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
  protected doOpenFile() {
    this.selectedFile.emit(this.resource)
    this.hide()        
  }

  protected doSave(){
    console.log(this.resource)
    this.saveAsFile.emit(this.resource)
    this.hide()
  }

  public listDir() {
    this.fileBackend.listDir(this.resource.dir).subscribe(
      data => {
        this.files = data.files.sort((f1, f2) => {
          return f1.name.localeCompare(f2.name)
        })
        this.resource.dir = data.dir
      },
      err => console.log(err)
    )

  }
}   