import { ChangeDetectorRef, Component, Input } from '@angular/core'
import { Machine, toUserUnits2, toInches2, UserUnit } from './settings.service'


@Component({
  selector: 'general-settings',
  templateUrl: 'general-settings.component.html'
})
export class GeneralSettingsComponent {

  @Input()
  machine: Machine

  constructor(private cdr: ChangeDetectorRef) {

  }

  set defaultUnit(value: UserUnit) {
    this.machine.defaultUnit = value
    this.cdr.detectChanges()
  }
  get defaultUnit() {
    return this.machine.defaultUnit
  }


  set dimX(value: string) {
    this.machine.dimX = toInches2(value, this.machine.defaultUnit)
  }
  get dimX() {
    return toUserUnits2(this.machine.dimX, this.machine.defaultUnit)
  }
  set dimY(value: string) {
    this.machine.dimY = toInches2(value, this.machine.defaultUnit)
  }
  get dimY() {
    return toUserUnits2(this.machine.dimY, this.machine.defaultUnit)
  }
  set dimZ(value: string) {
    this.machine.dimZ = toInches2(value, this.machine.defaultUnit)
  }
  get dimZ() {
    return toUserUnits2(this.machine.dimZ, this.machine.defaultUnit)
  }
}