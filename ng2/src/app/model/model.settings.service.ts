import { Injectable, Inject } from '@angular/core'
import { JsonFileStore } from '../backend/json-file-store'
import { IFileBackend, FileServiceToken } from '../resources'

export class Material {
  name: string
  ppi: string
  speed: string
  passes: number
  thickness: number

}
export class SVGModelSettings {
  private UnitsPerInch = {
    mm: 25.4,
    in: 1
  }
  unit: 'mm'|'in' = 'mm'
  //unit: string = 'in'
  dpi: number = 72
  renderText: boolean = false

  getDPIScaleFactor(dpi?:number){
    const DPI = dpi || this.dpi || 72

    if (this.UnitsPerInch[this.unit]) {
      return this.UnitsPerInch[this.unit] / DPI
    } else {
      console.log('Invalid unit ' + this.unit)
      return 1
    }
  }
}
export class IGMModelSettings {
  scale: number = 1
  unit: 'mm'|'in' = 'mm'
  cutZ: number = 0 //20,
  safeZ: number = 0//10
  fractionalDigits: number = 3
  translateToOrigo: boolean = true
  removeOutline: boolean = false
  removeDuplicates: boolean = true
  removeSingularites: boolean = true
  initCode: string = 'M100 P200 Q100'
  feedRate: number = 250
  passes: number = 1
  materialWidth: number = 10
}
export class PDFModelSettings {
  page: number = 1
  rotate: number = 90 // rotate 90 degrees to fit machine area
  scale: number = 1.0
}
export class ModelSettings {
  svg = new SVGModelSettings()
  pdf = new PDFModelSettings()
  igm = new IGMModelSettings()
  materials: Material[] = [] //ex { name: 'Cut 2mm polysterene', ppi: 'M100 P900 Q100', speed: 'F250', passes: 1, thickness: 2 },
  update(from: ModelSettings) {

    this.svg = from.svg
    this.pdf = from.pdf
    this.igm = from.igm
    this.materials = from.materials

    //Object.assign(new Foo, { a: 1 })
    //Reattach prototype of svg since there are functions in that class
    //setPrototype of is said to be slow. This does not happen often though
    Object.setPrototypeOf(this.svg, SVGModelSettings.prototype)
  }
}

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



