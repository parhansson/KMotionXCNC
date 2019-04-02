import { Injectable, Inject } from '@angular/core'
import { BackendService } from '../backend/backend.service'
import { JsonFileStore } from '../backend/json-file-store'
import { SocketService } from '../backend/socket.service'
import { IFileBackend, FileServiceToken } from '../resources'
import { Decimal } from 'decimal.js'

export type UserUnit = 'mm' | 'in'

const UnitsPerInch = {
  mm: 25.4,
  in: 1
}
export function toInches2(value: string | number, fromUnit: UserUnit){
  if(!value){
    return undefined 
  }
  const convertFactor = UnitsPerInch[fromUnit]
  const result = new Decimal(value).div(convertFactor)
  return result.toSignificantDigits(17).valueOf()
}

export function toUserUnits2(value: string | number, unit: UserUnit){
  if(!value){
    return undefined 
  }
  const convertFactor = UnitsPerInch[unit]
  const result = new Decimal(value).mul(convertFactor)
  return result.toSignificantDigits(17).valueOf()
}


export interface Machine  {
  
  name: string
  dimX: number | string
  dimY: number | string
  dimZ: number | string
  defaultUnit: UserUnit
  description: string
  axes: Axis[]
  tplanner: TPlanner
  actions: Action[]
  specialActions: Action[]
  extendedActions: Action[]
  userActions: Action[]
}
export class Axis {
  name: string
  countsPerUnit: number | string //actually count per inch. might be displayed as coutns per mm
  maxAccel: number | string
  maxVel: number | string
  jogVel: number | string
  constructor(name: string) {
    this.name = name
  }
}
export class Action {
  action: number
  name: string
  dParam0?: number
  dParam2?: number
  dParam3?: number
  dParam1?: number
  dParam4?: number
  file?: string
}
export class TPlanner {
  breakangle: number
  cornertolerance: number | string
  lookahead: number
  collineartolerance: number | string
  facetangle: number
}

@Injectable()
export class SettingsService extends JsonFileStore<Machine>{

  public readonly DefaultPath = 'settings/machines'

  constructor(
    private kmxBackend: BackendService,
    private socketService: SocketService,
    @Inject(FileServiceToken) fileBackend: IFileBackend) {
    super(fileBackend, SettingsService.update({} as Machine, {} as Machine))
    this.socketService.machineSetupFileSubject.subscribe(machineFile => {
      //console.log(machineFile, machineFile.canonical)
      this.load(machineFile.canonical)

    })
  }
  private get machine() {
    return this.obj
  }
  get fileName(): string {
    return `${this.DefaultPath}/${this.machine.name}.cnf`
  }
  onSave(){
    this.kmxBackend.onUpdateMotionParams()
    this.kmxBackend.setMachineFile(this.fileName)
  }
  onLoad(machine: Machine) {
    SettingsService.update(this.obj, machine)
    this.kmxBackend.setMachineFile(this.fileName)
  }


  private static mcodes = ['M0', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9', 'S']
  private static mcodesSpecial = ['M30', 'Cycle Start', 'Halt', 'Stop', 'Feedhold', 'Resume', 'Prog Start', 'Prog Exit']
  private static mcodesExtended = ['M100', 'M101', 'M102', 'M103', 'M104', 'M105', 'M106', 'M107', 'M108', 'M109', 'M110', 'M111', 'M112', 'M113', 'M114', 'M115', 'M116', 'M117', 'M118', 'M119']


  private static update(machine: Machine, newValue: Machine) {
    machine.name = newValue.name || null
    machine.description = newValue.description || null
    machine.dimX = newValue.dimX || 0
    machine.dimY = newValue.dimY || 0
    machine.dimZ = newValue.dimZ || 0
    machine.defaultUnit = newValue.defaultUnit || 'mm'
    machine.axes = newValue.axes || SettingsService.axesArr()
    machine.tplanner = newValue.tplanner || new TPlanner()
    machine.actions = SettingsService.actionsArr(newValue.actions, SettingsService.mcodes)
    machine.specialActions = SettingsService.actionsArr(newValue.specialActions, SettingsService.mcodesSpecial)
    machine.extendedActions = SettingsService.actionsArr(newValue.extendedActions, SettingsService.mcodesExtended)
    machine.userActions = newValue.userActions || SettingsService.userActionsArr()
    return machine
  }

  private static axesArr(): Axis[] {
    const axes = []
    const axisNames = ['X', 'Y', 'Z', 'A', 'B', 'C']
    for (let i = 0; i < 6; i++) {
      axes.push(new Axis(axisNames[i]))
    }
    return axes
  }

  private static actionsArr(existingActions: Action[], codes: string[]) {

    const actions = existingActions || []
    for(const codeName of codes) {
      let found = false
      for(const action of actions) {
        if (action.name === codeName) {
          found = true
          break
        }
      }
      if (!found) {
        actions.push({
          action: 0,
          name: codeName
        })
      }
    }
    //Remove faulty named actions
    let idx = actions.length
    while (idx--) {
      if (codes.indexOf(actions[idx].name) < 0) {
        actions.splice(idx, 1)
      }
    }

    actions.sort(function compare(a, b) {
      return codes.indexOf(a.name) - codes.indexOf(b.name)
    })
    return actions
  }

  private static userActionsArr() {
    const actions = []
    for (let i = 0; i < 10; i++) {
      actions.push({
        action: 0
      })

    }
    return actions
  }

}

