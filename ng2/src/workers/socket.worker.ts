import { SocketMessageBroker } from '@kmx/backend/socket/socket.message.broker'
const workerInstance: Worker = self as any
const smb = new SocketMessageBroker(workerInstance)

