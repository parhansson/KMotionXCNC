import {
  CB_COMPLETE,
  CB_CONSOLE,
  CB_ERR_MSG,
  CB_MESSAGEBOX,
  CB_STATUS,
  CB_USER,
  CB_USER_M_CODE,
  type Axes8,
  type ControlMessage,
  type ControlMessagePayload,
  type KmxMainStatus,
  type KmxStatus,
} from './types';

/** Fixed byte size of the packed MAIN_STATUS header + 6 DRO doubles + flags + currentLine + 2 empty string lengths & timestamps. */
export const MIN_STATUS_BINARY_BYTES = 527;

const textDecoder = new TextDecoder('utf-8');
const textEncoder = new TextEncoder();

export type DecodedWsMessage =
  | { kind: 'hello'; message: string }
  | { kind: 'control'; message: ControlMessage }
  | { kind: 'unknown'; raw: string };

function readInt32Array(view: DataView, offset: number, count: number): number[] {
  const out = new Array<number>(count);
  for (let i = 0; i < count; i++) {
    out[i] = view.getInt32(offset + i * 4, true);
  }
  return out;
}

function readFloat64Array(view: DataView, offset: number, count: number): number[] {
  const out = new Array<number>(count);
  for (let i = 0; i < count; i++) {
    out[i] = view.getFloat64(offset + i * 8, true);
  }
  return out;
}

function readUint8Array(view: DataView, offset: number, count: number): number[] {
  const out = new Array<number>(count);
  for (let i = 0; i < count; i++) {
    out[i] = view.getUint8(offset + i);
  }
  return out;
}

function array8ToAxes8(values: readonly number[]): Axes8 {
  return {
    X: values[0] ?? 0,
    Y: values[1] ?? 0,
    Z: values[2] ?? 0,
    A: values[3] ?? 0,
    B: values[4] ?? 0,
    C: values[5] ?? 0,
    U: values[6] ?? 0,
    V: values[7] ?? 0,
  };
}

/**
 * Decodes a binary WebSocket status frame emitted by `kmxWeb` (`WebController::UpdateClient`).
 * Uses DataView with littleEndian=true to handle unaligned fields (e.g. currentLine at offset 507).
 */
export function decodeStatusBinary(input: ArrayBuffer | Uint8Array, offline = false): KmxStatus {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.byteLength < MIN_STATUS_BINARY_BYTES) {
    throw new RangeError(
      `kmxWeb binary status frame too short: expected at least ${MIN_STATUS_BINARY_BYTES} bytes, got ${bytes.byteLength}`,
    );
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  const versionAndSize = view.getInt32(0, true);
  const adc = readInt32Array(view, 4, 24);
  const dac = readInt32Array(view, 100, 8);
  const pwm = readInt32Array(view, 132, 16);
  const position = readFloat64Array(view, 196, 8);
  const dest = readFloat64Array(view, 260, 8);
  const outputChan0 = readUint8Array(view, 324, 8);
  const inputModes = view.getInt32(332, true);
  const inputModes2 = view.getInt32(336, true);
  const outputModes = view.getInt32(340, true);
  const outputModes2 = view.getInt32(344, true);
  const enables = view.getInt32(348, true);
  const axisDone = view.getInt32(352, true);
  const bitsDirection: [number, number] = [view.getInt32(356, true), view.getInt32(360, true)];
  const bitsState: [number, number] = [view.getInt32(364, true), view.getInt32(368, true)];
  const snapBitsDirection0 = view.getInt32(372, true);
  const snapBitsDirection1 = view.getInt32(376, true);
  const snapBitsState0 = view.getInt32(380, true);
  const snapBitsState1 = view.getInt32(384, true);
  const kanalogBitsStateInputs = view.getInt32(388, true);
  const kanalogBitsStateOutputs = view.getInt32(392, true);
  const runOnStartUp = view.getInt32(396, true);
  const threadActive = view.getInt32(400, true);
  const stopImmediateState = view.getInt32(404, true);
  const timeStamp = view.getFloat64(408, true);
  const pcComm = readInt32Array(view, 416, 8);
  const virtualBits = view.getInt32(448, true);
  const virtualBitsEx0 = view.getInt32(452, true);

  const mainStatus: KmxMainStatus = {
    versionAndSize,
    adc,
    dac,
    pwm,
    position,
    dest,
    outputChan0,
    inputModes,
    inputModes2,
    outputModes,
    outputModes2,
    enables,
    axisDone,
    bitsDirection,
    bitsState,
    snapBitsDirection0,
    snapBitsDirection1,
    snapBitsState0,
    snapBitsState1,
    kanalogBitsStateInputs,
    kanalogBitsStateOutputs,
    runOnStartUp,
    threadActive,
    stopImmediateState,
    timeStamp,
    pcComm,
    virtualBits,
    virtualBitsEx0,
  };

  const dro: Axes8 = {
    X: view.getFloat64(456, true),
    Y: view.getFloat64(464, true),
    Z: view.getFloat64(472, true),
    A: view.getFloat64(480, true),
    B: view.getFloat64(488, true),
    C: view.getFloat64(496, true),
    U: 0,
    V: 0,
  };

  const connected = view.getUint8(504) !== 0;
  const simulate = view.getUint8(505) !== 0;
  const interpreting = view.getUint8(506) !== 0;
  const currentLine = view.getInt32(507, true);

  let cursor = 511;
  const gcodeFileLen = view.getInt32(cursor, true);
  cursor += 4;
  if (gcodeFileLen < 0 || cursor + gcodeFileLen + 8 > bytes.byteLength) {
    throw new RangeError(
      `kmxWeb binary status frame truncated while reading gcodeFile (len=${gcodeFileLen})`,
    );
  }
  const gcodeFile = textDecoder.decode(bytes.subarray(cursor, cursor + gcodeFileLen));
  cursor += gcodeFileLen;
  const gcodeFileTimestamp = view.getInt32(cursor, true);
  cursor += 4;

  const settingsFileLen = view.getInt32(cursor, true);
  cursor += 4;
  if (settingsFileLen < 0 || cursor + settingsFileLen + 4 > bytes.byteLength) {
    throw new RangeError(
      `kmxWeb binary status frame truncated while reading settingsFile (len=${settingsFileLen})`,
    );
  }
  const settingsFile = textDecoder.decode(bytes.subarray(cursor, cursor + settingsFileLen));
  cursor += settingsFileLen;
  const settingsFileTimestamp = view.getInt32(cursor, true);
  cursor += 4;

  // Optional trailing interpreter modal bytes (length_units: 1=in, 2=mm; distance_mode: 0=G90, 1=G91; block_delete: 0/1)
  let lengthUnits: 'in' | 'mm' | undefined;
  let distanceMode: 'G90' | 'G91' | undefined;
  let blockDelete: boolean | undefined;
  if (cursor + 2 <= bytes.byteLength) {
    const unitsByte = view.getUint8(cursor);
    const distByte = view.getUint8(cursor + 1);
    if (unitsByte === 1) lengthUnits = 'in';
    else if (unitsByte === 2) lengthUnits = 'mm';
    if (unitsByte === 1 || unitsByte === 2) {
      distanceMode = distByte === 1 ? 'G91' : 'G90';
      if (cursor + 3 <= bytes.byteLength) {
        blockDelete = view.getUint8(cursor + 2) !== 0;
      }
    }
  }

  return {
    dro,
    position: array8ToAxes8(position),
    dest: array8ToAxes8(dest),
    currentLine,
    connected,
    interpreting,
    simulate,
    offline,
    gcodeFile,
    gcodeFileTimestamp,
    settingsFile,
    settingsFileTimestamp,
    lengthUnits,
    distanceMode,
    blockDelete,
    timeStamp,
    mainStatus,
  };
}

/**
 * Encodes a `KmxStatus` into the exact packed little-endian binary layout produced by `WebController::UpdateClient`.
 * Useful for round-trip tests and local simulators.
 */
export function encodeStatusBinary(status: KmxStatus): ArrayBuffer {
  const gcodeBytes = textEncoder.encode(status.gcodeFile);
  const settingsBytes = textEncoder.encode(status.settingsFile);
  // Match WebController.cpp allocation (+9 trailing padding bytes)
  const totalSize = 456 + 6 * 8 + 4 * 4 + gcodeBytes.byteLength + 4 + settingsBytes.byteLength + 4 + 8;
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  const out = new Uint8Array(buffer);
  const ms = status.mainStatus;

  view.setInt32(0, ms.versionAndSize, true);
  for (let i = 0; i < 24; i++) view.setInt32(4 + i * 4, ms.adc[i] ?? 0, true);
  for (let i = 0; i < 8; i++) view.setInt32(100 + i * 4, ms.dac[i] ?? 0, true);
  for (let i = 0; i < 16; i++) view.setInt32(132 + i * 4, ms.pwm[i] ?? 0, true);
  for (let i = 0; i < 8; i++) view.setFloat64(196 + i * 8, ms.position[i] ?? 0, true);
  for (let i = 0; i < 8; i++) view.setFloat64(260 + i * 8, ms.dest[i] ?? 0, true);
  for (let i = 0; i < 8; i++) view.setUint8(324 + i, ms.outputChan0[i] ?? 0);

  view.setInt32(332, ms.inputModes, true);
  view.setInt32(336, ms.inputModes2, true);
  view.setInt32(340, ms.outputModes, true);
  view.setInt32(344, ms.outputModes2, true);
  view.setInt32(348, ms.enables, true);
  view.setInt32(352, ms.axisDone, true);
  view.setInt32(356, ms.bitsDirection[0], true);
  view.setInt32(360, ms.bitsDirection[1], true);
  view.setInt32(364, ms.bitsState[0], true);
  view.setInt32(368, ms.bitsState[1], true);
  view.setInt32(372, ms.snapBitsDirection0, true);
  view.setInt32(376, ms.snapBitsDirection1, true);
  view.setInt32(380, ms.snapBitsState0, true);
  view.setInt32(384, ms.snapBitsState1, true);
  view.setInt32(388, ms.kanalogBitsStateInputs, true);
  view.setInt32(392, ms.kanalogBitsStateOutputs, true);
  view.setInt32(396, ms.runOnStartUp, true);
  view.setInt32(400, ms.threadActive, true);
  view.setInt32(404, ms.stopImmediateState, true);
  view.setFloat64(408, status.timeStamp >= 0 ? status.timeStamp : ms.timeStamp, true);
  for (let i = 0; i < 8; i++) view.setInt32(416 + i * 4, ms.pcComm[i] ?? 0, true);
  view.setInt32(448, ms.virtualBits, true);
  view.setInt32(452, ms.virtualBitsEx0, true);

  view.setFloat64(456, status.dro.X, true);
  view.setFloat64(464, status.dro.Y, true);
  view.setFloat64(472, status.dro.Z, true);
  view.setFloat64(480, status.dro.A, true);
  view.setFloat64(488, status.dro.B, true);
  view.setFloat64(496, status.dro.C, true);

  view.setUint8(504, status.connected ? 1 : 0);
  view.setUint8(505, status.simulate ? 1 : 0);
  view.setUint8(506, status.interpreting ? 1 : 0);
  view.setInt32(507, status.currentLine, true);

  let cursor = 511;
  view.setInt32(cursor, gcodeBytes.byteLength, true);
  cursor += 4;
  out.set(gcodeBytes, cursor);
  cursor += gcodeBytes.byteLength;
  view.setInt32(cursor, status.gcodeFileTimestamp, true);
  cursor += 4;

  view.setInt32(cursor, settingsBytes.byteLength, true);
  cursor += 4;
  out.set(settingsBytes, cursor);
  cursor += settingsBytes.byteLength;
  view.setInt32(cursor, status.settingsFileTimestamp, true);
  cursor += 4;
  if (status.lengthUnits) {
    view.setUint8(cursor, status.lengthUnits === 'mm' ? 2 : 1);
    view.setUint8(cursor + 1, status.distanceMode === 'G91' ? 1 : 0);
    view.setUint8(cursor + 2, status.blockDelete ? 1 : 0);
  }

  return buffer;
}

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null;
}

function parseControlPayload(raw: Record<string, unknown>): ControlMessagePayload | null {
  const type = raw.type;
  const block = Boolean(raw.block);

  switch (type) {
    case CB_STATUS:
      return {
        type: CB_STATUS,
        block,
        line: typeof raw.line === 'number' ? raw.line : Number(raw.line ?? 0),
        message: String(raw.message ?? ''),
      };
    case CB_COMPLETE:
      return {
        type: CB_COMPLETE,
        block,
        line: typeof raw.line === 'number' ? raw.line : Number(raw.line ?? 0),
        status: typeof raw.status === 'number' ? raw.status : Number(raw.status ?? 0),
        sequence: typeof raw.sequence === 'number' ? raw.sequence : Number(raw.sequence ?? 0),
        message: String(raw.message ?? ''),
      };
    case CB_ERR_MSG:
      return {
        type: CB_ERR_MSG,
        block,
        message: String(raw.message ?? ''),
      };
    case CB_CONSOLE:
      return {
        type: CB_CONSOLE,
        block,
        message: String(raw.message ?? ''),
      };
    case CB_USER:
      return {
        type: CB_USER,
        block,
        message: String(raw.message ?? ''),
      };
    case CB_USER_M_CODE:
      return {
        type: CB_USER_M_CODE,
        block,
        code: typeof raw.code === 'number' ? raw.code : Number(raw.code ?? 0),
      };
    case CB_MESSAGEBOX:
      return {
        type: CB_MESSAGEBOX,
        block,
        options: typeof raw.options === 'number' ? raw.options : Number(raw.options ?? 0),
        title: String(raw.title ?? ''),
        message: String(raw.message ?? ''),
      };
    default:
      return null;
  }
}

/**
 * Decodes a WebSocket text frame from `kmxWeb`.
 * Handles both the initial `"KMotionX"` handshake greeting and JSON `ControlMessage` callbacks.
 */
export function decodeTextMessage(text: string): DecodedWsMessage {
  const trimmed = text.trim();
  if (trimmed === 'KMotionX') {
    return { kind: 'hello', message: trimmed };
  }

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (isRecord(parsed) && typeof parsed.id === 'number' && isRecord(parsed.payload)) {
      const payload = parseControlPayload(parsed.payload);
      if (payload) {
        return {
          kind: 'control',
          message: { id: parsed.id, payload },
        };
      }
    }
  } catch {
    // Fall through to unknown
  }

  return { kind: 'unknown', raw: text };
}

/**
 * Formats a blocking callback acknowledgement frame in the exact key order expected by
 * `WebController::OnReceiveClientData` (`sscanf`).
 */
export function encodeCallbackAck(id: number, returnValue: number): string {
  return `{"type":"CB_ACK","id":${Math.trunc(id)},"returnValue":${Math.trunc(returnValue)}}`;
}
