import { Injectable } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { Observable, Observer, Subject, AsyncSubject } from 'rxjs'
import { map, shareReplay } from 'rxjs/operators'
import { FileResource, Payload, IFileBackend, DirList } from '../../resources'
import { BackendService } from '../backend.service'
import { baseUrl } from '../../../main'

@Injectable(
  // TODO declare as tree shakable provider
  // {
  //   providedIn: 'root',
  // }
)
export class KFlopBackendService extends BackendService implements IFileBackend {
  constructor(private http: HttpClient) { super() }

  public listDir(path: string): Observable<DirList> {
    return this.onEvent('listDir', path)
  }

  saveFile(name: string, content: ArrayBuffer | ArrayBufferView | Blob | string) {
    const url = baseUrl + '/upload'
    let progressObserver: Observer<number>
    //progress: number = 0;
    const progress$ = new Observable<number>(observer => { progressObserver = observer })
    const formData: FormData = new FormData()

    // Pass the machine-relative path explicitly; do not rely on File.name
    // preserving directory components.
    const blob = new Blob([content], { type: 'application/octet-stream' })
    formData.append('file', blob, name)

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

    const url = baseUrl + '/api/kmx/openFile'
    const data = { params: path }
    //make cold hot to prevent reposting with shareReplay operator
    const hotObservable = this.http.post(url, JSON.stringify(data),
      {
        responseType: 'arraybuffer',
        observe: 'response'
      }).pipe(
        map((res) => new Payload(res.body, res.headers.get('Content-Type')))
      ).pipe(shareReplay())
    const subscr = hotObservable.subscribe(
      data => { },
      err => console.error('There was an error on openFile ', err),
      () => {
        subscr.unsubscribe()
        console.log('openFile Complete')
      }
    )
    return hotObservable
  }

  protected onEvent<R>(eventName: string, parameters?: any): Observable<R> {
    const url = baseUrl + '/api/kmx/' + eventName
    let payload: string
    if (parameters === undefined) {
      payload = JSON.stringify({})
    } else {
      payload = JSON.stringify({ params: parameters })
    }
    // make cold hot to prevent reposting with shareReplay operator
    const hotObservable = this.http.post(url, payload).pipe(shareReplay())
    const subscr = hotObservable.subscribe(
      data => { },
      err => console.error('There was an error on event: ' + eventName, err),
      () => {
        subscr.unsubscribe()
        console.log(eventName + ' Complete')
      }
    )
    return hotObservable as Observable<R>
  }

}
