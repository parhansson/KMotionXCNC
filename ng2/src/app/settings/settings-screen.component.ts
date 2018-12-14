import { Component } from '@angular/core'
import { SettingsService, Machine } from './settings.service'
import { ModelSettingsService } from '../model/model.settings.service'
import {
    FileDialogComponent,
    FileResource,
    Payload,
    FileStoreToken,
    FileStore
  } from '../resources'

@Component({
    selector: 'settings-screen',
    templateUrl: './settings-screen.html'
})
export class SettingsScreenComponent {
    machine: Machine
    resource: FileResource
    constructor(private settingsService: SettingsService, private modelSettingsService: ModelSettingsService) {
        
        this.resource = new FileResource(settingsService.DefaultPath)
    }

    }

    onSave() {
        this.settingsService.save()
        this.modelSettingsService.save()
    }
    
    onSaveAs(resource: FileResource) {
        console.log(resource)
        //this.save()
    }

    onFile(file: FileResource | Payload) {
        if (file instanceof FileResource) {
          this.resource = file
        } else {
          //Use imported name
          this.resource.canonical = file.name
        }
        //Selected in file dialog or drop imported file
        //load() should be responsible for returning file resource.
        //then imported files can be saved and get a real name
        this.settingsService.load(this.resource.canonical)
        //this.fileStore.load(file)
    
      }
}