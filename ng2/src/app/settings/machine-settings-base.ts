import { Component} from '@angular/core'
import { SettingsService, Machine } from './settings.service'
@Component({
  template:''
})
export class MachineSettingsBase {
  machine: Machine
  constructor(private settingsService: SettingsService) {
      settingsService.subject.subscribe(machine => {
          //console.log('machineupdate')
          this.machine = machine
          this.onMachineUpdate()
      })
  }

  protected onMachineUpdate(){

  }

}