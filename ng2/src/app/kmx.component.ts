import { Component, Inject } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'

import { SocketService } from './backend/socket.service'
import { KmxStatus } from './hal/kflop'
import { BackendService } from './backend/backend.service'

@Component({
    selector: 'kmx-app',
    templateUrl: './kmx.component.html',
    styles: ['.router-link-active { background-color: #AAA; }'],
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
        private socketService: SocketService, private backend: BackendService,
        private route: ActivatedRoute, private router: Router) {
        this.intStatus = this.socketService.data
        //socketService.simluateObservable.subscribe(()=>this.intStatus = this.socketService.data)
    }
    onSimulate() {
        this.backend.onSimulate()
    }
    processDrop(event:DragEvent){
        event.preventDefault()
        event.stopImmediatePropagation()
    }
    processDragExit(){
        //this.router.navigateByUrl('/gcode', {relativeTo:this.route});
        document.body.classList.remove('import')
     }  
  
    processDragOverOrEnter(){
       //this.router.navigateByUrl('/import', {relativeTo:this.route});
       document.body.classList.add('import')
    }    
}