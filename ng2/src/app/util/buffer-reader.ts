
export class BufferReader {
  littleEndian = true
  dv: DataView
  off = 0

  constructor(private buf: ArrayBuffer) {
    this.dv = new DataView(this.buf)
  }

  skip(bytesToSkip: number) {
    this.off = this.off + bytesToSkip
  }
  byte() {
    const val = this.dv.getUint8(this.off)
    this.off += 1
    return val
  }
  short() {
    const val = this.dv.getUint16(this.off, this.littleEndian)
    this.off += 2
    return val
  }
  int() {
    const val = this.dv.getUint32(this.off, this.littleEndian)
    this.off += 4
    return val
  }
  double() {
    const val = this.dv.getFloat64(this.off, this.littleEndian)
    this.off += 8
    return val
  }
  string(): string {
    const len = this.int()
    // The protocol length is bytes, not decoded characters. A zero-length
    // filename means no program is selected; never consume its timestamp.
    if (len > this.dv.byteLength - this.off) {
      throw new RangeError('Truncated status string')
    }
    const val = new TextDecoder('utf-8').decode(new Uint8Array(this.buf, this.off, len))
    this.off += len
    return val
  }
}
