import { Injectable, Inject } from '@angular/core'
import { Observable, Subject } from 'rxjs/Rx'
import { FileStoreToken, FileStore } from './file-store'
import { FileResource } from './file-resource'
import { IFileBackend,FileServiceToken} from './file-backend'
import { Payload } from './payload'


@Injectable()
export class DefaultFileStore implements FileStore {
  textSubject = new Subject<string>()

  constructor( @Inject(FileServiceToken) private fileBackend: IFileBackend) {

  }

  store(name: string, content: ArrayBuffer | ArrayBufferView | Blob | string) {
    this.fileBackend.saveFile(name, content)
  }

  load(resource: FileResource | Payload) {
    if (resource instanceof Payload) {
      //Drop imported file
      this.textSubject.next(resource.text())
    } else {
      //Selected in file dialog
      if (resource.file) {
        const subscription = this.fileBackend.loadFile(resource.canonical).subscribe(
          data => {
            this.textSubject.next(data.text())
          },
          null,
          () => subscription.unsubscribe()
        )
      }
    }
  }
}