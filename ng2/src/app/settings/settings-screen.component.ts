import { Component } from '@angular/core'
import { SettingsService, Machine } from './settings.service'
import { ModelSettingsService } from '../model/model.settings.service'

@Component({
    selector: 'settings-screen',
    templateUrl: './settings-screen.html'
})
export class SettingsScreenComponent {
    machine: Machine

    constructor(private settingsService: SettingsService, private modelSettingsService: ModelSettingsService) {

        settingsService.subject.subscribe(machine => this.machine = machine)
    }

    save() {
        this.settingsService.save()
        this.modelSettingsService.save()
    }
}