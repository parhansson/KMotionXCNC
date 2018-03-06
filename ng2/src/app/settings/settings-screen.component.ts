import { Component } from '@angular/core'
import { SettingsService, Machine } from './settings.service'
import { MCodeValueComponent } from './mcode-value.component'

@Component({
    selector: 'settings-screen',
    templateUrl: './settings-screen.html'
})
export class SettingsScreenComponent {
    machine: Machine

    constructor(private settingsService: SettingsService) {

        settingsService.subject.subscribe(machine => this.machine = machine)
    }

    save() {
        this.settingsService.save()
    }
}