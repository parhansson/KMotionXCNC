import { Component, HostBinding, Inject } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'

import { SocketService } from './backend/socket.service'
import { KmxStatus } from './hal/kflop'
import { BackendService } from './backend/backend.service'

@Component({
    selector: 'kmx-app',
    templateUrl: './kmx.component.html',
    styles: [
        '.router-link-active { background-color: #AAA; }',
        ':host.import a.importer {color:red}'
    ],
    host: {
        '(dragover)': 'processDragOverOrEnter($event)',
        '(dragenter)': 'processDragOverOrEnter($event)',
        '(dragleave)': 'processDragExit($event)',
        '(drop)': 'processDrop($event)'
      }
})
export class KmxComponent {
    intStatus: KmxStatus
    constructor(//private router:Router,
        socketService: SocketService, private backend: BackendService,
        private route: ActivatedRoute, private router: Router) {
        socketService.status.subscribe(status => {
            this.intStatus = status
        })
        //this.intStatus = this.socketService.data
        //socketService.simluateObservable.subscribe(()=>this.intStatus = this.socketService.data)
    }
    // alternatively also the host parameter in the @Component()` decorator can be used
    @HostBinding('class.import')
    dragOver: boolean = false

    onSimulate() {
        this.backend.onSimulate()
    }
    processDrop(event:DragEvent){
        event.preventDefault()
        event.stopImmediatePropagation()
        this.dragOver = false
    }
    processDragExit(){
        //this.router.navigateByUrl('/gcode', {relativeTo:this.route});
        this.dragOver = false
     }  
  
    processDragOverOrEnter(){
       //this.router.navigateByUrl('/import', {relativeTo:this.route});
       this.dragOver = true
    }    
}