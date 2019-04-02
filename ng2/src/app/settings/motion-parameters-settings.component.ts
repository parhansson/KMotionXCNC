import { Component, Input} from '@angular/core'
import { Machine, toInches2, toUserUnits2 } from './settings.service'

@Component({
  selector: 'motion-parameters-settings',
  templateUrl: 'motion-parameters-settings.component.html'
})
export class MotionParametersSettingsComponent {

  @Input()
  machine: Machine
  
  set cornertolerance(value:string){
    this.machine.tplanner.cornertolerance = toInches2(value, this.machine.defaultUnit)
  }
  get cornertolerance(){
    return toUserUnits2(this.machine.tplanner.cornertolerance, this.machine.defaultUnit)
  }

  set collineartolerance(value:string){
    this.machine.tplanner.collineartolerance  = toInches2(value, this.machine.defaultUnit)
  }
  get collineartolerance(){
    return toUserUnits2(this.machine.tplanner.collineartolerance, this.machine.defaultUnit)
  }

  setJogVel(value: string, axisName: string){
    this.getAxis(axisName).jogVel = toInches2(value, this.machine.defaultUnit)
  }
  getJogVel(axisName: string){
    return toUserUnits2(this.getAxis(axisName).jogVel, this.machine.defaultUnit)
  }

  setMaxVel(value: string, axisName: string){
    this.getAxis(axisName).maxVel = toInches2(value, this.machine.defaultUnit)
  }
  getMaxVel(axisName: string){
    return toUserUnits2(this.getAxis(axisName).maxVel, this.machine.defaultUnit)
  }

  setMaxAccel(value: string, axisName: string){
    this.getAxis(axisName).maxAccel = toInches2(value, this.machine.defaultUnit)
  }
  getMaxAccel(axisName: string){
    return toUserUnits2(this.getAxis(axisName).maxAccel, this.machine.defaultUnit)
  }

  setCounts(value: number, axisName: string){
    this.getAxis(axisName).countsPerUnit = toUserUnits2(value, this.machine.defaultUnit)
  }

  getCounts(axisName: string){
    return toInches2(this.getAxis(axisName).countsPerUnit, this.machine.defaultUnit)
  }

  private getAxis(name: string){
    return this.machine.axes.find(a => a.name === name)
  }

}