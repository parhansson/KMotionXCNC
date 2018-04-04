import { InjectionToken } from '@angular/core'
import { Observable, Subject } from 'rxjs'
import { FileResource, Payload } from '../resources'

export const FileStoreToken = new InjectionToken('editor-file-store')

export interface FileStore {
  textSubject: Subject<string>
  store(name: string, content: ArrayBuffer | ArrayBufferView | Blob | string)
  load(file: FileResource | Payload)
}