import {
  AfterViewChecked,
  Component,
  ElementRef,
  Input,
  OnInit,
  OnDestroy,
  ViewChild
} from '@angular/core'
import { Subscription } from 'rxjs'
import { bufferTime} from 'rxjs/operators'
import { LogService, LogMessage } from './log.service'
import { LimitBuffer } from '../util'

@Component({
  selector: 'kmx-log',
  templateUrl: './log.component.html',
  styleUrls: ['./log.component.css'],
})
export class LogComponent implements OnInit, OnDestroy, AfterViewChecked {
   
  @Input()
  title: string
  
  @Input()
  consoleId: string
  
  @Input()
  logLimit: number
  
  @Input()
  autoscroll: boolean = true
  logs: LogMessage[] = []

  private loggBuffer: LimitBuffer<LogMessage>

  private subscription: Subscription
  @ViewChild('scrollContainer', {static: false})
  private scrollContainer: ElementRef
  

  constructor(private logService: LogService) {
    this.logLimit = 200
    this.loggBuffer = new LimitBuffer<LogMessage>(this.logLimit)
    this.logs = this.loggBuffer.getEvents()
  }
  //http://stackoverflow.com/questions/35232731/angular2-scroll-to-bottom-chat-style
  ngOnInit() {
    this.logLimit = this.logLimit < 1 ? 1 : this.logLimit
    this.updateLimit()
    this.subscribe()
  }

  ngOnDestroy() {
    this.subscription.unsubscribe()
  }

  ngAfterViewChecked() {
    //TODO this is called all the time in this view
    if (this.autoscroll) {
      this.scrollToBottom()
    }
    //console.log('ngAfterViewChecked')
  }
  updateLimit() {
    //this.logSubject.setBufferSize(this.logLimit)
    this.loggBuffer.setBufferSize(this.logLimit)
  }
  
  prune() {
    this.loggBuffer.prune()
  }

  private scrollToBottom(): void {
    const container = this.scrollContainer.nativeElement
    container.scrollTop = container.scrollHeight
  }

  private subscribe() {
    const buffered = this.logService.getLogSubject(this.consoleId).pipe(bufferTime(100))
    this.subscription = buffered.subscribe(logMessages => {
      if(logMessages.length > 0) {
        console.log('added messagecount' + logMessages.length)
        this.loggBuffer.addValues(logMessages)
      } 
    })
  }
}