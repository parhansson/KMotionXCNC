import { Injectable, Inject, SkipSelf } from '@angular/core'
import { Observable, Subject } from 'rxjs'
import { FileResource, Payload, IFileBackend, FileServiceToken, FileStore } from '../resources'
import { BackendService } from '../backend/backend.service'
import { StaticTransformer } from './transformers'

@Injectable()
export class TransformingFileStore implements FileStore {
  payloadSubject = new Subject<Payload>()
  textSubject = new Subject<string>()

  //private staticTransformer: StaticTransformer
  constructor(
    @Inject(FileServiceToken) private fileBackend: BackendService,
    private staticTransformer: StaticTransformer
  ) {
    this.payloadSubject.subscribe(
      payload => {
        this.staticTransformer.transform(payload.contentType || payload.name, payload.arrayBuffer())
      })
    this.staticTransformer.gcodeSubject.subscribe(
      gcode => {
        this.textSubject.next(gcode.text)
      })
  }

  store(name: string, content: ArrayBuffer | ArrayBufferView | Blob | string) {
    this.fileBackend.saveFile(name, content)
    //when using save as we need to update loaded gcode file.
    //TODO needs cleanup - should not be done here
    this.fileBackend.setGCodeFile(name)
  }

  load(file: FileResource | Payload) {
    if (file instanceof Payload) {
      this.payloadSubject.next(file)
    } else {
      if (file.file) {
        //TODO needs cleanup - should not be done here
        this.fileBackend.setGCodeFile(file.canonical)
      }
    }

  }
}