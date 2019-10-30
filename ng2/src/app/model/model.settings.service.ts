import { Injectable, Inject } from '@angular/core'
import { JsonFileStore } from '../backend/json-file-store'
import { IFileBackend, FileServiceToken } from '../resources'
import { ModelSettings } from 'camx'

@Injectable()
export class ModelSettingsService extends JsonFileStore<ModelSettings>{
  
  constructor(
    @Inject(FileServiceToken) fileBackend: IFileBackend) {
    super(fileBackend, new ModelSettings())
    this.load(this.fileName)
  }
  get settings() {
    return this.obj
  }
  get fileName(): string {
    return './settings/import.cnf'
  }
  onSave(){

  }
  onLoad(settings: ModelSettings) {
    this.obj.update(settings)
    
  }
}



