export const AXIS_NAMES = ['X', 'Y', 'Z', 'A', 'B', 'C', 'U', 'V'] as const;

export type AxisName = (typeof AXIS_NAMES)[number];

export type Axes8 = Record<AxisName, number>;

export function createZeroAxes8(): Axes8 {
  return { X: 0, Y: 0, Z: 0, A: 0, B: 0, C: 0, U: 0, V: 0 };
}

export function cloneAxes8(axes: Readonly<Axes8>): Axes8 {
  return {
    X: axes.X,
    Y: axes.Y,
    Z: axes.Z,
    A: axes.A,
    B: axes.B,
    C: axes.C,
    U: axes.U,
    V: axes.V,
  };
}

export function axisNameToIndex(axis: AxisName): number {
  return AXIS_NAMES.indexOf(axis);
}

export function axisIndexToName(index: number): AxisName | undefined {
  return AXIS_NAMES[index];
}

export interface KmxMainStatus {
  versionAndSize: number;
  adc: number[];
  dac: number[];
  pwm: number[];
  /** Raw actual actuator positions (counts) for channels 0..7 (or up to 16 on Kogna). */
  position: number[];
  /** Raw commanded actuator destinations (counts) for channels 0..7 (or up to 16 on Kogna). */
  dest: number[];
  outputChan0: number[];
  inputModes: number;
  inputModes2: number;
  outputModes: number;
  outputModes2: number;
  /** Bitmask of enabled axes (bit i = axis i enabled). */
  enables: number;
  /** Bitmask of axes that have completed motion (bit i = axis i done). */
  axisDone: number;
  /** KFLOP digital I/O direction bitmasks (bits 0..31 and 32..63). */
  bitsDirection: [number, number];
  /** KFLOP digital I/O state bitmasks (bits 0..31 and 32..63). */
  bitsState: [number, number];
  snapBitsDirection0: number;
  snapBitsDirection1: number;
  snapBitsState0: number;
  snapBitsState1: number;
  kanalogBitsStateInputs: number;
  kanalogBitsStateOutputs: number;
  /** Bitmask of KFLOP C-program threads configured to run on startup (bits 1..7). */
  runOnStartUp: number;
  /** Bitmask of currently active KFLOP C-program threads (bits 1..7). */
  threadActive: number;
  /** Non-zero when Feed Hold / Stop Immediate is active. */
  stopImmediateState: number;
  /** KFLOP uptime in seconds (or seconds since midnight when offline/simulating). */
  timeStamp: number;
  /** Shared C-program <-> PC communication registers (8 ints). */
  pcComm: number[];
  virtualBits: number;
  virtualBitsEx0: number;
  /** Optional Kogna extended I/O state (bits 200+). */
  bitsState200?: number[];
  /** Optional Kogna extended analog inputs. */
  kognaAdc?: number[];
  /** Optional Kogna extended DAC outputs. */
  kognaDac?: number[];
  /** Optional Kogna extended PWM outputs. */
  kognaPwm?: number[];
}

export interface KmxStatus {
  /** Machine DRO coordinates from kmxWeb (linear axes in inches, rotary in degrees/inches per machine setup). */
  dro: Axes8;
  /** Actual position per axis (counts from MAIN_STATUS.Position[0..7]). */
  position: Axes8;
  /** Commanded destination per axis (counts from MAIN_STATUS.Dest[0..7]). */
  dest: Axes8;
  currentLine: number;
  connected: boolean;
  interpreting: boolean;
  simulate: boolean;
  offline: boolean;
  gcodeFile: string;
  gcodeFileTimestamp: number;
  settingsFile: string;
  settingsFileTimestamp: number;
  /** Active interpreter length units of `dro` ('in' = G20, 'mm' = G21). Undefined on legacy backends. */
  lengthUnits?: 'in' | 'mm';
  /** Active interpreter distance mode ('G90' | 'G91'). Undefined on legacy backends. */
  distanceMode?: 'G90' | 'G91';
  /** Active interpreter Block Delete ('/') flag. Undefined on legacy backends. */
  blockDelete?: boolean;
  timeStamp: number;
  mainStatus: KmxMainStatus;
}

export const CB_STATUS = 'STATUS' as const;
export const CB_COMPLETE = 'COMPLETE' as const;
export const CB_ERR_MSG = 'ERR_MSG' as const;
export const CB_CONSOLE = 'CONSOLE' as const;
export const CB_USER = 'USER' as const;
export const CB_USER_M_CODE = 'USER_M_CODE' as const;
export const CB_MESSAGEBOX = 'MESSAGEBOX' as const;

export type ControlMessageType =
  | typeof CB_STATUS
  | typeof CB_COMPLETE
  | typeof CB_ERR_MSG
  | typeof CB_CONSOLE
  | typeof CB_USER
  | typeof CB_USER_M_CODE
  | typeof CB_MESSAGEBOX;

export interface StatusCallbackPayload {
  type: typeof CB_STATUS;
  block: boolean;
  line: number;
  message: string;
}

export interface CompleteCallbackPayload {
  type: typeof CB_COMPLETE;
  block: boolean;
  line: number;
  /** Status 1005 indicates a normal resumable Halt rather than an error. */
  status: number;
  sequence: number;
  message: string;
}

export interface ErrorMessageCallbackPayload {
  type: typeof CB_ERR_MSG;
  block: boolean;
  message: string;
}

export interface ConsoleCallbackPayload {
  type: typeof CB_CONSOLE;
  block: boolean;
  message: string;
}

export interface UserCallbackPayload {
  type: typeof CB_USER;
  block: boolean;
  message: string;
}

export interface UserMCodeCallbackPayload {
  type: typeof CB_USER_M_CODE;
  block: boolean;
  code: number;
}

export interface MessageBoxCallbackPayload {
  type: typeof CB_MESSAGEBOX;
  block: boolean;
  options: number;
  title: string;
  message: string;
}

export type ControlMessagePayload =
  | StatusCallbackPayload
  | CompleteCallbackPayload
  | ErrorMessageCallbackPayload
  | ConsoleCallbackPayload
  | UserCallbackPayload
  | UserMCodeCallbackPayload
  | MessageBoxCallbackPayload;

export interface ControlMessage {
  id: number;
  payload: ControlMessagePayload;
}

export interface ControlMessageAck {
  type: 'CB_ACK';
  id: number;
  returnValue: number;
}

export interface BackendCapabilities {
  apiVersion: number;
  offline: boolean;
  maxAxes: number;
  jogHeartbeatMs?: number;
  features: {
    capabilities?: boolean;
    deadmanJog?: boolean;
    mdi?: boolean;
    fixtures?: boolean;
    [feature: string]: boolean | undefined;
  };
}

export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

export interface RawLogEntry {
  timestamp: number;
  direction: 'in' | 'out' | 'info' | 'error';
  message: string;
}

export interface DirEntry {
  name: string;
  /** POSIX dirent d_type (4 = directory, 8 = regular file). */
  type: number;
  isDirectory: boolean;
}

export interface DirListing {
  dir: string;
  files: DirEntry[];
  error?: string;
}

export interface KmxRpcResponse<TParams = unknown> {
  api?: string;
  func?: string;
  params?: TParams;
  ret: number;
}

export function createEmptyMainStatus(): KmxMainStatus {
  return {
    versionAndSize: 0,
    adc: new Array<number>(24).fill(0),
    dac: new Array<number>(8).fill(0),
    pwm: new Array<number>(16).fill(0),
    position: new Array<number>(8).fill(0),
    dest: new Array<number>(8).fill(0),
    outputChan0: new Array<number>(8).fill(0),
    inputModes: 0,
    inputModes2: 0,
    outputModes: 0,
    outputModes2: 0,
    enables: 0,
    axisDone: 0,
    bitsDirection: [0, 0],
    bitsState: [0, 0],
    snapBitsDirection0: 0,
    snapBitsDirection1: 0,
    snapBitsState0: 0,
    snapBitsState1: 0,
    kanalogBitsStateInputs: 0,
    kanalogBitsStateOutputs: 0,
    runOnStartUp: 0,
    threadActive: 0,
    stopImmediateState: 0,
    timeStamp: 0,
    pcComm: new Array<number>(8).fill(0),
    virtualBits: 0,
    virtualBitsEx0: 0,
  };
}

export function createEmptyKmxStatus(): KmxStatus {
  return {
    dro: createZeroAxes8(),
    position: createZeroAxes8(),
    dest: createZeroAxes8(),
    currentLine: -1,
    connected: false,
    interpreting: false,
    simulate: false,
    offline: false,
    gcodeFile: '',
    gcodeFileTimestamp: 0,
    settingsFile: '',
    settingsFileTimestamp: 0,
    timeStamp: -1,
    mainStatus: createEmptyMainStatus(),
  };
}
