import { Injectable } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { Observable, Observer, Subject, AsyncSubject } from 'rxjs'
import { map } from 'rxjs/operators'
import { FileResource, Payload, IFileBackend, DirList } from '../../resources'
import { BackendService } from '../backend.service'


@Injectable()
export class KFlopBackendService extends BackendService implements IFileBackend {
  constructor(private http: HttpClient) { super() }

  public listDir(path: string): Observable<DirList> {
    return this.onEvent('listDir', path)
  }

  saveFile(name: string, content: ArrayBuffer | ArrayBufferView | Blob | string) {
    const url: string = '/upload'
    let progressObserver: Observer<number>
    //progress: number = 0;
    const progress$ = new Observable<number>(observer => { progressObserver = observer })
    const formData: FormData = new FormData()

    if (File.constructor === Function) {
      const files: File[] = []
      files.push(new File([content], name))
      for (let i = 0; i < files.length; i++) {
        formData.append('file' + i, files[i], files[i].name)
      }
    } else {
      //Some browsers (Safari) does not support File constructor.
      const blob = new Blob([content], { type: 'plain/text', endings: 'transparent' })
      formData.append('file', blob, name)

    }

    //return new Promise((resolve, reject) => {

    const xhr: XMLHttpRequest = new XMLHttpRequest()
    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          //resolve(JSON.parse(xhr.response));
          progressObserver.complete()
        } else {
          //reject(xhr.response);
          progressObserver.error(xhr.response)
        }
      }
    }

    //FileUploadService.setUploadUpdateInterval(500);

    xhr.upload.onprogress = (event) => {
      const progress = Math.round(event.loaded / event.total * 100)
      progressObserver.next(progress)
    }

    xhr.open('POST', url, true)
    xhr.send(formData)
    // });
    progress$.subscribe(data => console.log(data + '%'))
    return progress$
  }

  loadFile(path: string): Observable<Payload> {

    const url = '/api/kmx/openFile'
    const data = { params: path }

    return this.http.post(url, JSON.stringify(data),
      {
        responseType: 'arraybuffer',
        observe: 'response'
      }).pipe(
        map((res) => {
          return new Payload(res.body, res.headers.get('Content-Type'))
        })
      )
    //return this.onEvent('openFile', { 'params': path });
  }

  protected onEvent<R>(eventName: string, parameters?: any): Observable<R> {
    const url = '/api/kmx/' + eventName
    let payload: string
    if (parameters === undefined) {
      payload = JSON.stringify({})
    } else {
      payload = JSON.stringify({ params: parameters })
    }
    // TODO make cold hot to prevent reposting
    const coldObservable = this.http.post(url, payload)
    coldObservable.subscribe(
      data => { },
      err => console.error('There was an error on event: ' + eventName, err),
      () => console.log(eventName + ' Complete')
    )
    return coldObservable as Observable<R>
  }

}
