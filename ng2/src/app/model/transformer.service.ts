

import { Injectable } from '@angular/core'
import { Observer, Observable, Subject, AsyncSubject } from 'rxjs'
import { KMXUtil, ModelTransformer } from 'camx'



@Injectable()
export class TransformerService {
  transformers: Array<ModelTransformer<any, any>> = []

  constructor() {

  }
  register(transformer: ModelTransformer<any, any>) {
    this.transformers.push(transformer)
  }

  matchType(mimeType: string) {
    for (const transformer of this.transformers) {
      if (transformer.inputMime.indexOf(mimeType) > -1) {
        return transformer
      }
    }
    return null
  }
  matchName(name) {
    for (const transformer of this.transformers) {
      if (transformer.name === name) {
        return transformer
      }
    }
    return null
  }
  transformNamed(transformerName, source) {

    const subject = new Subject<any>()
    const transformer = this.matchName(transformerName)
    if (transformer !== null) {
      return transformer.execute(source, subject)
    }
    subject.error('Named transformer "' + transformerName + '" not found')
    subject.complete()
  }
  transcode(mime: string, source: any): Subject<any> {
    const subject = new AsyncSubject<any>()
    const transformer = this.matchType(mime)
    if (transformer !== null) {
      transformer.execute(source, subject).subscribe(result => this.transcode(transformer.outputMime, result))
      /*
      var resultPromise = transformer.execute(source,subject);
      if (transformer.outputMime !== "application/x-gcode") {
        return resultPromise.then(
          (result) => {
            return this.transcode(transformer.outputMime, result);
          });
      }
      return resultPromise;
      */
    }

    if (typeof source === 'string') {
      //asume gcode text do not transform
      subject.next(source)
    } else if (source instanceof ArrayBuffer) {
      //gcode file do not transform
      subject.next(KMXUtil.ab2str(source))
    } else {
      subject.error('Unsupported source: ' + (typeof source))
    }
    subject.complete()

    return subject

  }

}




