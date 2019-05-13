import { Status } from '../status'

export class KmxStatus implements Status {
  timeStamp: number = 0
  version: number = 0
  size: number = 0
  position: number[] = []
  dest: number[] = []
  inputModes: number[] = []
  outputModes: number[] = []
  enables: boolean[] = []
  axisDone: boolean[] = []
  bitsDirection: boolean[] = []
  bitsState: boolean[] = []
  runOnStartUp: boolean[] = []
  threadActive: boolean[] = []
  stopImmediateState: number = -1
  dro: number[] = []
  feedHold: boolean = false
  connected: boolean = false
  simulating: boolean = true
  interpreting: boolean = false
  currentLine: number = 0
  gcodeFile: string = ''
  gcodeFileTimestamp: number = 0
  machineSettingsFile: string = ''
  machineSettingsFileTimestamp: number = 0

  constructor() { }

  copyFrom(from: KmxStatus) {
    let updated = false
    for (const key in from) {
      if (from.hasOwnProperty(key)) {
        //copy all the fields
        if(this[key].toString() != from[key].toString()){
          updated = true
          //console.log(key)
          this[key] = from[key]
          if(key !== 'timestamp'){
            // maybe here?
            // updated = true
          }
        }
      }
    }
    return updated
  }
}
