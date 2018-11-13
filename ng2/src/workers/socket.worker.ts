import { SocketMessageBroker } from '@kmx/backend/socket/socket.message.broker'
import { WebpackWorker } from './webpack'
const workerInstance: Worker = self as any

const smb = new SocketMessageBroker(workerInstance)
//Trick tsc and webpack to work together
export default WebpackWorker
