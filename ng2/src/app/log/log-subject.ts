import { Observer, Subject,Subscriber, Subscription} from 'rxjs'
//import { ObjectUnsubscribedError } from 'rxjs/util/ObjectUnsubscribedError'
import { LimitBuffer } from '../util'
/**
 * @class LogSubject<T>
 * This is the same as ReplaySubject but with the possibility to prune the events
 * and change bufferSize and windowTime is removed
 */

export class LogSubject<T> extends Subject<T> {
  private _buffer: LimitBuffer<T>

  constructor(bufferSize: number = Number.POSITIVE_INFINITY) {
    super()
    this._buffer = new LimitBuffer<T>(bufferSize)
  }

  setBufferSize(bufferSize: number) {
    this._buffer.setBufferSize(bufferSize)
  }

  prune(): void {
    this._buffer.prune()
  }

  next(value: T): void {
    this._buffer.add(value)
    super.next(value)
  }

  public _subscribe(subscriber: Subscriber<T>): Subscription {
    const _events = this._buffer.getEvents()
    let subscription: Subscription

    if (this.closed) {
      throw new Error('ObjectUnsubscribedError()')
    } else if (this.hasError) {
      subscription = Subscription.EMPTY
    } else if (this.isStopped) {
      subscription = Subscription.EMPTY
    } else {
      this.observers.push(subscriber)
      subscription = new SubjectSubscription(this, subscriber)
    }

    const len = _events.length
    for (let i = 0; i < len && !subscriber.closed; i++) {
      subscriber.next(_events[i])
    }

    if (this.hasError) {
      subscriber.error(this.thrownError)
    } else if (this.isStopped) {
      subscriber.complete()
    }

    return subscription
  }
}
/**
 * This class is a copy of SubjectSubscription that is no longer exported
 */
class SubjectSubscription<T> extends Subscription {
  closed: boolean = false

  constructor(public subject: Subject<T>, public subscriber: Observer<T>) {
    super()
  }

  unsubscribe() {
    if (this.closed) {
      return
    }

    this.closed = true

    const subject = this.subject
    const observers = subject.observers

    this.subject = null

    if (!observers || observers.length === 0 || subject.isStopped || subject.closed) {
      return
    }

    const subscriberIndex = observers.indexOf(this.subscriber)

    if (subscriberIndex !== -1) {
      observers.splice(subscriberIndex, 1)
    }
  }
}
