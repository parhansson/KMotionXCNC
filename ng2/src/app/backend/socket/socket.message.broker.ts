
import { SocketConnector, SocketMessageHandler, SerializedObject } from '../../util'
import { KmxStatusParser, KmxStatus, ControlMessage } from '../../hal/kflop'
import { LogMessage } from './messages'

export class SocketMessageBroker implements SocketMessageHandler {

  socket: SocketConnector
  kmxStatusStream: KmxStatusParser

  constructor(private messagePort: any) {
    //messagePort.onmessage = this.onmessage.bind(this);
    this.kmxStatusStream = new KmxStatusParser()
    this.socket = new SocketConnector(this, 'KMotionX')
    this.post('WorkerReady')
  }

  onSocketMessage(data: ArrayBuffer | Blob | string) {
    if (data instanceof ArrayBuffer) {
      this.onBinaryMessage(data)
    } else if (data instanceof Blob) {
      const reader = new FileReader()
      // reader.result contains the contents of blob as a typed array
      reader.addEventListener('loadend', this.onBinaryMessage.bind(this, reader.result))
      reader.readAsArrayBuffer(data)
    } else {
      if (data !== 'KMotionX') {
        //try{ //try catch disables optimization in chrome
        const ctrlMessage = JSON.parse(data) as ControlMessage
        this.post(new ControlMessage(ctrlMessage))
        //ack messages that don't require users answer here
        if (ctrlMessage.payload.block === false) {
          this.acknowledge(ctrlMessage.id, -1)
        }

        //} catch(e){
        //  console.log(data);
        //  logHandler("Error handling message: " + data, LOG_TYPE.ERROR);
        //  throw e;
        //}
      }
    }
  }



  onSocketLog(message: string, type: number) {
    this.post(new LogMessage(message, type))

  }

  onmessage(event: MessageEvent) {
    const data = event.data
    if (data.command == 'connect') {
      const url = data.url
      this.socket.connect(url)
    } else if (data.command == 'acknowledge') {
      this.acknowledge(data.id, data.ret)
    } else if (data.command == 'disconnect') {
      //no need to acually disconnect at the moment
      this.socket.destroy()
      this.post('done')
    }

  }

  private onBinaryMessage(data: ArrayBuffer) {
    const status = this.kmxStatusStream.readBuffer(data)
    this.post(status)
  }

  private acknowledge(id, ret) {
    this.socket.sendMessage(JSON.stringify({ type: 'CB_ACK', id, returnValue: ret }))
  }

  private post(payload: string | LogMessage | KmxStatus | ControlMessage) {
    let message:SerializedObject<string | LogMessage | KmxStatus | ControlMessage> 
    if(payload instanceof KmxStatus) {
      message = {KmxStatus: payload }
    } else if(payload instanceof LogMessage) {
      message = {LogMessage: payload }
    } else if(payload instanceof ControlMessage) {
      message = {ControlMessage: payload }
    } else  {
      message = {Command: payload }
    }
    
    this.messagePort.postMessage(message)
  }

}