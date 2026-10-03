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
                <span class="fa-solid fa-minus"></span>
              </button>              
              <button class="input-group-append" (mousedown)="jogStartPos(index)" (mouseup)="jogStop(index)" (mouseleave)="jogStop(index)">
                  <span class="fa-solid fa-plus"></span>
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

    // Settings store jogVel and maxVel in inches/sec and countsPerUnit in counts/inch,
    // but KFLOP's Jog command takes counts/sec
    private jogCountsPerSec(axis: number) {
        const settings = this.machine.axes[axis]
        let vel = Number(settings.jogVel) || 0
        const maxVel = Number(settings.maxVel)
        if (maxVel > 0) {
            vel = Math.min(vel, maxVel)
        }
        return Math.round(vel * (Number(settings.countsPerUnit) || 0))
    }

    jogStartPos(axis: number) {
        this.backendService.jog(axis, this.jogCountsPerSec(axis))
        this.jogging = true
    }

    jogStartNeg(axis: number) {
        this.backendService.jog(axis, -this.jogCountsPerSec(axis))
        this.jogging = true
    }

    jogStop(axis: number, speed: number) {
        if (this.jogging) {
            this.backendService.jog(axis, 0)
        }
        this.jogging = false
    }
}