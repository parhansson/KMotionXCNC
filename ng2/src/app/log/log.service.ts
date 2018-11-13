import { Component, Inject, Injectable } from '@angular/core'
import { ReplaySubject } from 'rxjs'

interface LogIdToLogSubjectMap {
  [id: string]: ReplaySubject<LogMessage>
}
export class LogMessage {
  constructor(public message: string, public styleClass?: string) {
  }
}

@Injectable()
export class LogService {

  private logs: LogIdToLogSubjectMap = {}

  constructor() {

  }

  public getLogSubject(logId: string) {
    let subject = this.logs[logId]
    if (subject === undefined) {
      subject = this.logs[logId] = new ReplaySubject<LogMessage>(1000)
    }
    return subject
  }

  public logExist(logId: string) {
    return this.logs[logId] !== undefined
  }

  public log(consoleId: string, message: string, styleClass?:string) {
    this.getLogSubject(consoleId).next(new LogMessage(message, styleClass))
  }
}