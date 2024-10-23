import { Component } from '@angular/core'
import { BackendService } from '../backend/backend.service'
import { SocketService } from '../backend/socket.service'
import { KmxStatus } from '../hal/kflop'
import { SettingsService, Machine } from '../settings/settings.service'

@Component({
    selector: 'kmx-dro',
    template: `
      <div>
          <div *ngFor=" let name of droAxes; let index = index" class="input-group">
            <div class="input-group-prepend">
                <div class="input-group-text">{{name}}</div>
            </div>

              <span class="form-control input-lg text-right dro-display">{{intStatus.dro[index] | number:'1.3-3'}}</span>
              <button class="input-group-append" (mousedown)="jogStartNeg(index)" (mouseup)="jogStop(index)" (mouseleave)="jogStop(index)">
                <span class="fa fa-minus"></span>
              </button>              
              <button class="input-group-append" (mousedown)="jogStartPos(index)" (mouseup)="jogStop(index)" (mouseleave)="jogStop(index)">
                  <span class="fa fa-plus"></span>
              </button>
          </div>
      </div>    
    `,
   styleUrls: ['./dro.component.css']
})
export class DroComponent {
    droAxes = ['X', 'Y', 'Z']
    intStatus: KmxStatus
    machine: Machine
    jogging: boolean = false

    constructor(
        private backendService: BackendService,
        private socketService: SocketService,
        private settingsService: SettingsService) {
        this.socketService.status.subscribe(status => {
            this.intStatus = status
        })
    }
    ngAfterViewInit() {
        this.settingsService.subject.subscribe((machine) => this.machine = machine)
    }

    jogStartPos(axis: number) {
        this.backendService.jog(axis, +this.machine.axes[axis].jogVel)
        this.jogging = true
    }

    jogStartNeg(axis: number) {
        this.backendService.jog(axis, -this.machine.axes[axis].jogVel)
        this.jogging = true
    }

    jogStop(axis: number, speed: number) {
        if (this.jogging) {
            this.backendService.jog(axis, 0)
        }
        this.jogging = false
    }
}