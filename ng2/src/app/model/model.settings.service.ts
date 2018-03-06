import { Injectable } from '@angular/core'
export class Material {
  name: string
  ppi: string
  speed: string
  passes: number
  thickness: number

}
export class SVGModelSettings {
  scale: number = 1
  unit: 'mm'|'in' = 'mm'
  //unit: string = 'in'
  dpi: number = 72
  renderText: boolean = false
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
  materials: Material[] = [
    { name: 'Cut 2mm polysterene', ppi: 'M100 P900 Q100', speed: 'F250', passes: 1, thickness: 2 },
    { name: 'Cut 3mm acrylic', ppi: 'M100 P1000 Q100', speed: 'F200', passes: 1, thickness: 3 },
    { name: 'Cut 6mm acrylic', ppi: 'M100 P2200 Q100 ', speed: 'F90', passes: 1, thickness: 6 },
    { name: 'Cut 4mm plywood', ppi: 'M100 P300 Q100 ', speed: 'F250', passes: 1, thickness: 4 },
    { name: 'Cut 10mm pine P900 down to P600', ppi: 'M100 P900 Q100', speed: 'F50', passes: 1, thickness: 10 },
    { name: 'Cut 3mm expensive hobby plywood many layers', ppi: 'M100 P700 Q100', speed: 'F150', passes: 3, thickness: 3 },
    { name: 'Cut paper 220-240g', ppi: 'M100 P400 Q100', speed: 'F1000', passes: 1, thickness: 0.1 }

  ]

}

@Injectable()
export class ModelSettingsService {
  settings: ModelSettings = new ModelSettings()

  constructor() {

  }

}



