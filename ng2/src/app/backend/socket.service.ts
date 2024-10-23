import { Injectable } from '@angular/core'
import { Subject, BehaviorSubject, ReplaySubject } from 'rxjs'
import { LogService, LogLevel } from '../log'
import { SerializedObject } from '../util'
import { KmxStatus, ControlMessagePayload, ControlMessage } from '../hal/kflop'
import { LogMessage } from './socket/messages'

import { FileResource } from '../resources'

import SocketWorker from '@workers/socket.worker'
import {baseUrl} from '../../main'


@Injectable()
export class SocketService {
  gcodeFileSubject: Subject<FileResource> = new ReplaySubject<FileResource>(1)
  machineSetupFileSubject: Subject<FileResource> = new ReplaySubject<FileResource>(1)
  simulateSubject: Subject<boolean> = new BehaviorSubject<boolean>(true)
  status: Subject<KmxStatus> = new BehaviorSubject<KmxStatus>(new KmxStatus())
  private data: KmxStatus = new KmxStatus()

  private socketWorker: Worker

  constructor(private kmxLogger: LogService) {

    this.data.dro = [0, 0, 0]
    this.data.timeStamp = -1
    this.data.simulating = false
    this.data.currentLine = -1
    
    this.socketWorker = new SocketWorker() //new (SocketWorker as any)()
    this.socketWorker.addEventListener('message', (event) => {this.onWorkerMessage(event)})
    //does not seem to work, at least not in chrome
    //      window.onbeforeunload = function(){
    //        socketWorker.postMessage({command:'disconnect'})
    //      }
  }
  //Message type guards
  private isText(payload: SerializedObject<any>): payload is SerializedObject<string> {
    return payload.Command !== undefined
  }

  private isControl(payload: SerializedObject<any>): payload is SerializedObject<ControlMessage> {
    return payload.ControlMessage !== undefined
  }

  private isStatus(payload: SerializedObject<any>): payload is SerializedObject<KmxStatus> {
    return payload.KmxStatus !== undefined
  }

  private isLog(payload: SerializedObject<any>): payload is SerializedObject<LogMessage> {
    return payload.LogMessage !== undefined
  }

  private onWorkerMessage(event: MessageEvent) {
    const payload = event.data as SerializedObject<any>
    if (this.isText(payload)) {
      this.onTextMessage(payload.Command)
    } else if (this.isControl(payload)) {
      this.onControlMessage(payload.ControlMessage)
    } else if (this.isStatus(payload)) {
      this.onStatusMessage(payload.KmxStatus)
    } else if (this.isLog(payload)) {
      this.onLogMessage(payload.LogMessage)
    }
  }

  private acknowledge(id, ret) {
    this.socketWorker.postMessage({ command: 'acknowledge', id, ret })
  }

  private onTextMessage(textMessage: string) {
    if (textMessage === 'WorkerReady') {
      const url =  baseUrl.replace('https://','wss://').replace('http://','ws://') + '/ws'
      this.socketWorker.postMessage({ command: 'connect', url })
    }
  }

  private onStatusMessage(raw: KmxStatus) {
    //  console.log('simulating', this.data.simulating)
    // if(this.data.simulating !== raw.simulating){
    //   this.simulateSubject.next(this.data.simulating)
    // }
    if (this.data.simulating !== raw.simulating) {
      console.log(raw.simulating)
    }
    //timestamp in StatusMessage to detect file modifications
    const gcodeFileUpdated = (this.data.gcodeFileTimestamp !== raw.gcodeFileTimestamp || this.data.gcodeFile !== raw.gcodeFile)
    //   //timestamp in StatusMessage to detect file modifications
    const machineFileUpdated = (this.data.machineSettingsFileTimestamp !== raw.machineSettingsFileTimestamp || this.data.machineSettingsFile !== raw.machineSettingsFile)
    
    if(this.data.copyFrom(raw)){
      this.status.next(this.data)
    }
    if(machineFileUpdated){
      const machineSetupResource = new FileResource()
      machineSetupResource.canonical = this.data.machineSettingsFile
      this.machineSetupFileSubject.next(machineSetupResource)
    }
    if(gcodeFileUpdated){
      const gcodeResource = new FileResource()
      gcodeResource.canonical = this.data.gcodeFile
      this.gcodeFileSubject.next(gcodeResource)
    }

  }

  private onControlMessage(obj: ControlMessage) {
    const payload = obj.payload
    let ret
    switch (payload.type) {
      case 'STATUS': // 0: Non blocking callback. Called from the interpreter in different thread
        {
          this.kmxLogger.log('status', 'Line: ' + payload.line + ' - ' + payload.message)
          return
        }
      case 'COMPLETE':// 1: Non blocking callback. Called from the interpreter in different thread
        {
          this.kmxLogger.log('status', 'Done Line: ' + payload.line + ' Status: ' + payload.status + ' Sequence ' + payload.sequence + ' - ' + payload.message)
          return
        }
      case 'ERR_MSG':// 2: Non blocking callback
        {
          this.kmxLogger.log('error', payload.message)
          return
        }
      case 'CONSOLE':// 3: Non blocking callback, event though it has return value??
        {
          this.kmxLogger.log('console', payload.message)
          return
        }
      case 'USER': // 4: Blocking callback. Called from the interpreter in different thread
        {
          if (confirm('USR: ' + payload.message + ' ?')) {
            ret = 0 // zero is true for this callback
          } else {
            ret = 1
          }
          break
        }
      case 'USER_M_CODE': // 5: Blocking callback. Called from the interpreter in different thread
        {
          if (confirm('Are you sure you want to continue after M' + payload.code + ' ?')) {
            ret = 0 // zero is true for this callback
          } else {
            ret = 1
          }
          break
        }
      case 'MESSAGEBOX': // 6: Blocking callback. However there is no need to block OK only boxes.
        {
          alert(payload.message)
          ret = 0
          break
        }
    }

    if (obj.payload.block === true) {
      //only ack messages that require users answer here
      this.acknowledge(obj.id, ret)
    }
  }


  private onLogMessage(logMessage: LogMessage) {
    const message = logMessage.message
    const type = logMessage.type

    let prefixClass = ''
    if (type == LogLevel.INFO.valueOf()) {
      prefixClass = 'info'
    } else if (type == LogLevel.SEND.valueOf()) {
      prefixClass = 'outgoing'
    } else if (type as LogLevel == LogLevel.RECEIVE.valueOf()) {
      prefixClass = 'incomming'
    } else if (type as LogLevel == LogLevel.ERROR.valueOf()) {
      prefixClass = 'error'
    }

    this.kmxLogger.log('output', message, prefixClass)

  }
}