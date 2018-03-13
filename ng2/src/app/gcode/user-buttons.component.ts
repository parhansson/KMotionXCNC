import { Component } from '@angular/core'
import { SettingsService, Machine, Action } from '../settings/settings.service'
import { BackendService } from '../backend/backend.service'

@Component({
  selector: 'user-defined-buttons',
  template: `
    <span *ngFor="let action of userActions; let index = index">
      <button  
        *ngIf="action.action > 0" 
        class='btn btn-primary btn-grid'
        (click)="onUserButton(index, action)">{{action.name || '[Unnamed]'}}
      </button>
    </span>   
    `,
    styles: [`
    .btn-grid {
      width:32%;
      margin-top:2px;
      margin-bottom: 2px;
    }
  `]
})
export class UserButtonsComponent {
  userActions: Action[] = []
  constructor(settingsService: SettingsService, private backendService: BackendService) {
    settingsService.subject.subscribe(machine => 
      this.userActions = machine.userActions
    )
  }

  onUserButton(index: number, action: Action) {
    console.log(index, action)
    this.backendService.onInvokeAction(index + 11)
  }

}