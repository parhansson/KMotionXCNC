import { BackendService } from '../backend/backend.service'
import { IFileBackend, FileServiceToken } from '../resources'
import { KMXUtil } from '../util/kmxutil'
import { Subject, ReplaySubject } from 'rxjs'

export abstract class JsonFileStore<T>{
  public subject: Subject<T>
  constructor(
    private fileBackend: IFileBackend,
    protected obj: T) {
    this.subject = new ReplaySubject<T>(1)
  }
  public save(): void {
    this.fileBackend.saveFile(this.fileName, JSON.stringify(this.obj, null, '  ')).subscribe(
      () => {
        this.onSave()
        this.subject.next(this.obj)
      })
  }
  public load(file) {

    this.fileBackend.loadFile(file).subscribe(
      (payload) => {
        this.onLoad(payload.json())
        this.subject.next(this.obj)
      },
      err => {
        console.error(err)
        this.subject.next(this.obj)
      },
      () => console.log('File loaded: ' + file)
    )
  }
  abstract onSave(): void
  abstract onLoad(data: T): void
  abstract get fileName(): string
  
}
