import { Component } from '@angular/core'
import { BackendService } from '../backend/backend.service'
import { SocketService } from '../backend/socket.service'
import { KmxStatus } from '../hal/kflop'

@Component({
  selector: 'control-buttons',
  template: `
  <div>
    <div class="btn-toolbar">
      <div clas="btn-group btn-group-justified">
          <div *ngIf="kmxStatus.interpreting" class="btn btn-primary active" (click)="onCycleStart()"><span class='fa fa-pause'></span>Halt</div>
          <div *ngIf="!kmxStatus.interpreting" class="btn btn-primary" (click)="onCycleStart()"><span class='fa fa-play'></span>Cycle Start</div>
          <div class="btn btn-primary" [ngClass]="kmxStatus.feedHold ? 'active' : ''" (click)="onFeedhold()"><span class='fa'></span>Feed Hold</div>
        </div>
      </div>
      <div class="btn-toolbar">
        <div class="btn-group btn-group-sm btn-group-justified">
          <div class="btn btn-primary" (click)="onStep()"><span class='fa fa-step-forward'></span>Step</div>
          <div class="btn btn-primary" (click)="onReset()"><span class='fa fa-fast-backward'></span>Reset</div>
        </div>
      </div>
      <div class="btn btn-danger btn-block" (click)="onEmergencyStop()"><span class='fa fa-remove'></span>E-Stop</div>
    </div>  
  `
})
export class ControlButtonsComponent {
  kmxStatus: KmxStatus

  constructor(private backendService: BackendService,
    private socketService: SocketService) {
    this.kmxStatus = socketService.data

  }

  onFeedhold() {
    this.backendService.onFeedhold()
  }

  onHalt() {
    this.backendService.onHalt()
  }

  onCycleStart() {
    this.backendService.onCycleStart()
  }

  onReset() {
    this.backendService.onReset()
  }

  onStep() {
    this.backendService.onStep()
  }
  onEmergencyStop() {
    this.backendService.onEmergencyStop()
  }

}