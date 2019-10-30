import { Component, Inject } from '@angular/core'
import { ModelSettings } from 'camx'
import { ModelSettingsService } from '../model/model.settings.service'

@Component({
  selector: 'transformer-settings',
  templateUrl: 'transformer-settings.html'
})
export class TransformerSettingsComponent {
  transformerSettings: ModelSettings
  constructor(private modelSettingsService: ModelSettingsService) {
    this.transformerSettings = modelSettingsService.settings
  }
}