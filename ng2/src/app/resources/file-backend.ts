import { InjectionToken } from '@angular/core'
import { Observable } from 'rxjs/Rx'
import { Payload } from './payload'

export const FileServiceToken = new InjectionToken('fileservice')

export interface FileEntry {
  name: string,
  type: number
}

export interface DirList {
  dir: string
  files: FileEntry[]
}

export interface IFileBackend {
  saveFile(name: string, content: ArrayBuffer | ArrayBufferView | Blob | string): Observable<number>

  loadFile(resource: string): Observable<Payload>

  listDir(path: string): Observable<DirList>
}