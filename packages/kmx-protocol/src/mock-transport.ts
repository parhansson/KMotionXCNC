import type { FileStorage, KmxTransport } from './transport';
import {
  AXIS_NAMES,
  CB_COMPLETE,
  CB_CONSOLE,
  CB_ERR_MSG,
  CB_STATUS,
  cloneAxes8,
  createEmptyMainStatus,
  createZeroAxes8,
  type Axes8,
  type AxisName,
  type BackendCapabilities,
  type ConnectionState,
  type ControlMessage,
  type DirEntry,
  type DirListing,
  type KmxRpcResponse,
  type KmxStatus,
  type RawLogEntry,
} from './types';

export const DEFAULT_SAMPLE_GCODE = `( KMXCNC Simulator Demo - 60x40mm Pocket & Contour )
G21 G90 G17
G0 Z5.000
G0 X0.000 Y0.000
M3
G0 X10.000 Y10.000
G1 Z-1.000 F300
G1 X70.000 Y10.000 F1200
G1 X70.000 Y50.000
G1 X10.000 Y50.000
G1 X10.000 Y10.000
G0 Z5.000
G0 X25.000 Y30.000
G1 Z-1.500 F300
G2 X55.000 Y30.000 I15.000 J0.000 F900
G2 X25.000 Y30.000 I-15.000 J0.000
G0 Z10.000
M5
G0 X0.000 Y0.000
M30
`;

export const DEFAULT_SAMPLE_MACHINE_JSON = JSON.stringify(
  {
    name: 'KMXCNC Simulator',
    description: 'Built-in 8-axis offline CNC simulator (300x210x60 mm)',
    dimX: 300 / 25.4,
    dimY: 210 / 25.4,
    dimZ: 60 / 25.4,
    defaultUnit: 'mm',
    uiProfile: 'mill-3axis',
    enabledPlugins: ['kflop', 'laser', 'generators'],
    axes: [
      {
        name: 'X',
        countsPerUnit: 2540,
        maxAccel: 40,
        maxVel: 25,
        jogVel: 40,
        softLimitNeg: -1,
        softLimitPos: 300 / 25.4,
      },
      {
        name: 'Y',
        countsPerUnit: 2540,
        maxAccel: 40,
        maxVel: 25,
        jogVel: 40,
        softLimitNeg: -1,
        softLimitPos: 210 / 25.4,
      },
      {
        name: 'Z',
        countsPerUnit: 4064,
        maxAccel: 30,
        maxVel: 15,
        jogVel: 20,
        softLimitNeg: -60 / 25.4,
        softLimitPos: 2,
      },
      { name: 'A', countsPerUnit: 100, maxAccel: 100, maxVel: 180, jogVel: 90, degrees: true, radius: 1 },
      { name: 'B' },
      { name: 'C' },
      { name: 'U' },
      { name: 'V' },
    ],
    tplanner: {
      breakangle: 5,
      cornertolerance: 0.003,
      lookahead: 3,
      collineartolerance: 0.0005,
      facetangle: 0.5,
    },
    actions: [
      { action: 0, name: 'M0' },
      { action: 0, name: 'M1' },
      { action: 0, name: 'M2' },
      { action: 1, name: 'M3', dParam0: 46, dParam1: 1 },
      { action: 0, name: 'M4', dParam0: 46, dParam1: 1 },
      { action: 1, name: 'M5', dParam0: 46, dParam1: 0 },
      { action: 0, name: 'M6' },
      { action: 0, name: 'M7' },
      { action: 0, name: 'M8' },
      { action: 0, name: 'M9' },
      { action: 0, name: 'S' },
    ],
    specialActions: [
      { action: 0, name: 'M30' },
      { action: 0, name: 'Cycle Start' },
      { action: 0, name: 'Halt' },
      { action: 0, name: 'Stop' },
      { action: 1, name: 'Feedhold', dParam0: 46, dParam1: 0 },
      { action: 1, name: 'Resume', dParam0: 46, dParam1: 1 },
      { action: 4, name: 'Prog Start', file: 'c-programs/LaserInit.c', dParam0: 2 },
      { action: 0, name: 'Prog Exit' },
    ],
    extendedActions: Array.from({ length: 20 }, (_, i) => ({
      action: i === 0 ? 4 : 0,
      name: `M${100 + i}`,
      ...(i === 0 ? { file: 'c-programs/LaserPPI.c', dParam0: 6 } : {}),
    })),
    userActions: [
      { action: 4, name: 'Init', dParam0: 2, file: 'c-programs/LaserInit.c' },
      { action: 4, name: 'Enable', dParam0: 2, file: 'c-programs/EnableAxes.c' },
      { action: 4, name: 'Blink LED', dParam0: 3, file: 'c-programs/BlinkKFLOP.c' },
      { action: 0 },
      { action: 0 },
      { action: 0 },
      { action: 0 },
      { action: 0 },
      { action: 0 },
      { action: 0 },
    ],
  },
  null,
  2,
);

const DEFAULT_C_PROGRAMS: Record<string, string> = {
  'c-programs/LaserInit.c': `#include "KMotionDef.h"

main() {
    // Initialize X, Y, Z axes for simulator
    EnableAxis(0);
    EnableAxis(1);
    EnableAxis(2);
    DefineCoordSystem(0, 1, 2, -1);
    printf("Simulator axes initialized\\n");
}
`,
  'c-programs/EnableAxes.c': `#include "KMotionDef.h"

main() {
    EnableAxis(0);
    EnableAxis(1);
    EnableAxis(2);
    printf("Axes enabled\\n");
}
`,
  'c-programs/BlinkKFLOP.c': `#include "KMotionDef.h"

main() {
    SetBitDirection(46, 1);
    SetBit(46);
    Delay_sec(0.25);
    ClearBit(46);
}
`,
  'c-programs/LaserPPI.c': `#include "KMotionDef.h"

main() {
    printf("Laser PPI thread started\\n");
}
`,
  'data/Default.tbl': `SLOT ID LENGTH DIAMETER COMMENT
1 1 0.0000 0.1250 1/8" Flat Endmill
2 2 0.0000 0.2500 1/4" Flat Endmill
3 3 0.0000 0.0080 Laser Beam (0.2mm)
`,
};

const MM_PER_INCH = 25.4;

export interface MockFileEntry {
  content: string | Uint8Array;
  timestamp: number;
}

export class MockFileStorage implements FileStorage {
  private readonly files = new Map<string, MockFileEntry>();
  private readonly onFileUpdatedListeners = new Set<(path: string, timestamp: number) => void>();

  constructor(initialFiles?: Record<string, string | Uint8Array>) {
    const now = Math.floor(Date.now() / 1000);
    this.files.set('settings/machine.json', { content: DEFAULT_SAMPLE_MACHINE_JSON, timestamp: now });
    this.files.set('gcode/demo.ngc', { content: DEFAULT_SAMPLE_GCODE, timestamp: now });
    for (const [k, v] of Object.entries(DEFAULT_C_PROGRAMS)) {
      this.files.set(k, { content: v, timestamp: now });
    }
    if (initialFiles) {
      for (const [k, v] of Object.entries(initialFiles)) {
        this.files.set(this.normalizePath(k), { content: v, timestamp: now });
      }
    }
  }

  private normalizePath(path: string): string {
    return path.replace(/^\/+/, '').replace(/\/+$/, '');
  }

  onFileUpdated(listener: (path: string, timestamp: number) => void): () => void {
    this.onFileUpdatedListeners.add(listener);
    return () => this.onFileUpdatedListeners.delete(listener);
  }

  getTimestamp(path: string): number {
    return this.files.get(this.normalizePath(path))?.timestamp ?? 0;
  }

  readFileSync(path: string): string | undefined {
    const entry = this.files.get(this.normalizePath(path));
    if (!entry) return undefined;
    if (typeof entry.content === 'string') return entry.content;
    return new TextDecoder('utf-8').decode(entry.content);
  }

  async listDir(path: string): Promise<DirListing> {
    const prefix = this.normalizePath(path);
    const dirPrefix = prefix ? `${prefix}/` : '';
    const entries = new Map<string, DirEntry>();

    for (const key of this.files.keys()) {
      if (dirPrefix && !key.startsWith(dirPrefix)) continue;
      const rest = dirPrefix ? key.slice(dirPrefix.length) : key;
      if (!rest) continue;
      const slashIdx = rest.indexOf('/');
      if (slashIdx === -1) {
        entries.set(rest, { name: rest, type: 8, isDirectory: false });
      } else {
        const subDir = rest.slice(0, slashIdx);
        entries.set(subDir, { name: subDir, type: 4, isDirectory: true });
      }
    }

    return {
      dir: prefix || '/',
      files: Array.from(entries.values()).sort((a, b) => a.name.localeCompare(b.name)),
    };
  }

  async readFile(path: string): Promise<string> {
    const text = this.readFileSync(path);
    if (text === undefined) {
      throw new Error(`MockFileStorage: file not found: ${path}`);
    }
    return text;
  }

  async readBinary(path: string): Promise<ArrayBuffer> {
    const entry = this.files.get(this.normalizePath(path));
    if (!entry) {
      throw new Error(`MockFileStorage: file not found: ${path}`);
    }
    if (typeof entry.content === 'string') {
      return new TextEncoder().encode(entry.content).buffer;
    }
    return entry.content.slice().buffer;
  }

  async writeFile(
    path: string,
    content: string | ArrayBuffer | Uint8Array | Blob,
  ): Promise<void> {
    await this.uploadFile(path, content);
  }

  async uploadFile(
    path: string,
    content: string | ArrayBuffer | Uint8Array | Blob,
  ): Promise<string> {
    const normalized = this.normalizePath(path);
    let stored: string | Uint8Array;
    if (typeof content === 'string') {
      stored = content;
    } else if (content instanceof Uint8Array) {
      stored = content.slice();
    } else if (content instanceof ArrayBuffer) {
      stored = new Uint8Array(content.slice(0));
    } else {
      stored = new Uint8Array(await content.arrayBuffer());
    }
    const timestamp = Math.floor(Date.now() / 1000);
    this.files.set(normalized, { content: stored, timestamp });
    for (const listener of this.onFileUpdatedListeners) {
      listener(normalized, timestamp);
    }
    const bytes = typeof stored === 'string' ? new TextEncoder().encode(stored).byteLength : stored.byteLength;
    return `Written ${bytes} bytes to file: ${normalized}\n\n`;
  }

  getResourceUrl(path: string): string {
    return `mock://${this.normalizePath(path)}`;
  }
}

export interface MockTransportOptions {
  storage?: MockFileStorage;
  /** Periodic status emit interval in ms (default: 100). Set to 0 to disable auto-timer (manual tick() only). */
  tickIntervalMs?: number;
  /** Initial G-code file path (default: 'gcode/demo.ngc'). */
  initialGcodeFile?: string;
  /** Simulate offline preview mode (default: false). */
  offline?: boolean;
  /** Counts per inch used to synthesize MAIN_STATUS.Position & Dest (default: 2540). */
  countsPerInch?: number;
}

export class MockTransport implements KmxTransport {
  readonly kind = 'mock' as const;
  readonly storage: MockFileStorage;

  private readonly tickIntervalMs: number;
  private readonly offline: boolean;
  private readonly countsPerInch: number;

  private state: ConnectionState = 'disconnected';
  private timer: ReturnType<typeof setInterval> | null = null;
  private startTimeMs = Date.now();
  private nextMsgId = 1;

  // Simulated controller state (DRO stored in inches, matching kmxWeb wire format)
  private dro: Axes8 = createZeroAxes8();
  private targetDro: Axes8 = createZeroAxes8();
  private jogSpeeds: Axes8 = createZeroAxes8();
  private enables = 0b00001111; // X, Y, Z, A enabled
  private threadActive = 0b00000010; // Thread 1 active
  private bitsState: [number, number] = [0x00000000, 0x00004000]; // Bit 46 (LED)
  private bitsDirection: [number, number] = [0x000000ff, 0x0000c000];
  private stopImmediateState = 0;
  private simulate = false;
  private interpreting = false;
  private stepMode = false;
  private currentLine = 0;
  private gcodeFile: string;
  private settingsFile = 'settings/machine.json';
  private gcodeLines: string[] = [];
  private modalInches = false; // G21 mm default
  private modalRelative = false; // G90 absolute default
  private feedMmPerMin = 1200;
  private activeFixture = 1; // G54
  private origins: Record<number, Axes8> = {};
  private lastAck: { id: number; returnValue: number } | null = null;

  private readonly statusListeners = new Set<(status: KmxStatus) => void>();
  private readonly messageListeners = new Set<(message: ControlMessage) => void>();
  private readonly stateListeners = new Set<(state: ConnectionState, error?: string) => void>();
  private readonly rawLogListeners = new Set<(entry: RawLogEntry) => void>();

  constructor(options: MockTransportOptions = {}) {
    this.storage = options.storage ?? new MockFileStorage();
    this.tickIntervalMs = options.tickIntervalMs ?? 100;
    this.offline = options.offline ?? false;
    this.countsPerInch = options.countsPerInch ?? 2540;
    this.gcodeFile = options.initialGcodeFile ?? 'gcode/demo.ngc';
    this.reloadGcodeLines();

    this.storage.onFileUpdated((path) => {
      if (path === this.gcodeFile) {
        this.reloadGcodeLines();
      }
    });
  }

  getLastAck(): { id: number; returnValue: number } | null {
    return this.lastAck;
  }

  getConnectionState(): ConnectionState {
    return this.state;
  }

  private setState(state: ConnectionState, error?: string): void {
    this.state = state;
    for (const listener of this.stateListeners) {
      listener(state, error);
    }
  }

  private emitRawLog(direction: RawLogEntry['direction'], message: string): void {
    const entry: RawLogEntry = { timestamp: Date.now(), direction, message };
    for (const listener of this.rawLogListeners) {
      listener(entry);
    }
  }

  private emitControl(payload: ControlMessage['payload']): void {
    const message: ControlMessage = { id: this.nextMsgId++, payload };
    for (const listener of this.messageListeners) {
      listener(message);
    }
  }

  /** Helper for tests/demos to trigger an interpreter callback (e.g., USER, MESSAGEBOX). */
  triggerCallback(payload: ControlMessage['payload']): number {
    const id = this.nextMsgId++;
    const message: ControlMessage = { id, payload };
    for (const listener of this.messageListeners) {
      listener(message);
    }
    return id;
  }

  private reloadGcodeLines(): void {
    const text = this.storage.readFileSync(this.gcodeFile) ?? '';
    this.gcodeLines = text.split(/\r?\n/);
  }

  async getCapabilities(): Promise<BackendCapabilities> {
    return {
      apiVersion: 1,
      offline: this.offline,
      maxAxes: 8,
      jogHeartbeatMs: 500,
      features: {
        capabilities: true,
        deadmanJog: true,
        mdi: true,
        fixtures: true,
        simulator: true,
      },
    };
  }

  async connect(): Promise<void> {
    this.setState('connecting');
    this.startTimeMs = Date.now();
    this.setState('connected');
    this.emitRawLog('info', 'Connected to KMXCNC built-in simulator');
    this.emitStatus();
    if (this.tickIntervalMs > 0) {
      this.timer = setInterval(() => this.tick(this.tickIntervalMs / 1000), this.tickIntervalMs);
    }
  }

  async disconnect(): Promise<void> {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.jogSpeeds = createZeroAxes8();
    this.setState('disconnected');
    this.emitRawLog('info', 'Disconnected from KMXCNC simulator');
  }

  private parseAndApplyGcodeLine(line: string): { moved: boolean; programEnd: boolean } {
    const cleaned = line
      .replace(/\([^)]*\)/g, '')
      .replace(/;.*$/, '')
      .trim()
      .toUpperCase();
    if (!cleaned) return { moved: false, programEnd: false };

    let moved = false;
    let programEnd = false;
    const nextTarget = cloneAxes8(this.dro);

    const tokenRe = /([A-Z])([+-]?(?:\d+\.?\d*|\.\d+))/g;
    let match: RegExpExecArray | null;
    while ((match = tokenRe.exec(cleaned)) !== null) {
      const letter = match[1];
      const value = Number(match[2]);
      if (!Number.isFinite(value)) continue;

      if (letter === 'G') {
        if (value === 20) this.modalInches = true;
        else if (value === 21) this.modalInches = false;
        else if (value === 90) this.modalRelative = false;
        else if (value === 91) this.modalRelative = true;
      } else if (letter === 'M') {
        if (value === 3) {
          // Turn on bit 46 (spindle/laser enable)
          this.bitsState[1] |= 1 << (46 - 32);
        } else if (value === 5) {
          this.bitsState[1] &= ~(1 << (46 - 32));
        } else if (value === 2 || value === 30) {
          programEnd = true;
        }
      } else if (letter === 'F') {
        this.feedMmPerMin = Math.max(10, this.modalInches ? value * MM_PER_INCH : value);
      } else if (
        letter === 'X' ||
        letter === 'Y' ||
        letter === 'Z' ||
        letter === 'A' ||
        letter === 'B' ||
        letter === 'C' ||
        letter === 'U' ||
        letter === 'V'
      ) {
        const axis = letter as AxisName;
        const isRotary = axis === 'A' || axis === 'B' || axis === 'C';
        const valInControllerUnits = isRotary
          ? value
          : this.modalInches
            ? value
            : value / MM_PER_INCH;
        nextTarget[axis] = this.modalRelative
          ? nextTarget[axis] + valInControllerUnits
          : valInControllerUnits;
        moved = true;
      }
    }

    if (moved) {
      this.targetDro = nextTarget;
    }
    return { moved, programEnd };
  }

  /** Advances simulator physics by `dtSec` seconds and emits a status frame. */
  tick(dtSec = 0.1): void {
    if (this.state !== 'connected') return;

    const isFeedHold = this.stopImmediateState !== 0;

    // 1. Handle continuous jogging
    let anyJogging = false;
    if (!isFeedHold && this.enables !== 0) {
      for (let i = 0; i < AXIS_NAMES.length; i++) {
        const axis = AXIS_NAMES[i]!;
        const speedCountsPerSec = this.jogSpeeds[axis];
        if (speedCountsPerSec !== 0 && (this.enables & (1 << i)) !== 0) {
          anyJogging = true;
          const deltaInches = (speedCountsPerSec / this.countsPerInch) * dtSec;
          this.dro[axis] += deltaInches;
          this.targetDro[axis] = this.dro[axis];
        }
      }
    }

    // 2. Handle G-code execution / stepping
    if (this.interpreting && !isFeedHold && !anyJogging) {
      // Interpolate toward targetDro
      const maxStepInches = Math.max(0.05, (this.feedMmPerMin / 60 / MM_PER_INCH) * dtSec * 4);
      let remaining = false;
      for (const axis of AXIS_NAMES) {
        const diff = this.targetDro[axis] - this.dro[axis];
        if (Math.abs(diff) > 1e-6) {
          if (Math.abs(diff) <= maxStepInches) {
            this.dro[axis] = this.targetDro[axis];
          } else {
            this.dro[axis] += Math.sign(diff) * maxStepInches;
            remaining = true;
          }
        }
      }

      if (!remaining) {
        if (this.currentLine >= this.gcodeLines.length) {
          this.interpreting = false;
          this.stepMode = false;
          this.emitControl({
            type: CB_COMPLETE,
            block: false,
            line: this.currentLine,
            status: 0,
            sequence: 0,
            message: 'Program complete',
          });
        } else {
          const lineText = this.gcodeLines[this.currentLine] ?? '';
          const { programEnd } = this.parseAndApplyGcodeLine(lineText);
          this.emitControl({
            type: CB_STATUS,
            block: false,
            line: this.currentLine,
            message: lineText,
          });
          this.currentLine += 1;

          if (programEnd) {
            this.interpreting = false;
            this.stepMode = false;
            this.emitControl({
              type: CB_COMPLETE,
              block: false,
              line: this.currentLine,
              status: 0,
              sequence: 0,
              message: 'Program end (M30)',
            });
          } else if (this.stepMode) {
            // In step mode, jump immediately to line target and stop
            this.dro = cloneAxes8(this.targetDro);
            this.interpreting = false;
            this.stepMode = false;
          }
        }
      }
    }

    this.emitStatus();
  }

  buildStatus(): KmxStatus {
    const mainStatus = createEmptyMainStatus();
    mainStatus.versionAndSize = 1;
    mainStatus.enables = this.enables;
    mainStatus.threadActive = this.threadActive;
    mainStatus.runOnStartUp = 0b00000010;
    mainStatus.stopImmediateState = this.stopImmediateState;
    mainStatus.bitsDirection = [this.bitsDirection[0], this.bitsDirection[1]];
    mainStatus.bitsState = [this.bitsState[0], this.bitsState[1]];
    mainStatus.timeStamp = (Date.now() - this.startTimeMs) / 1000;
    mainStatus.adc[0] = 1024;
    mainStatus.dac[0] = this.interpreting ? 512 : 0;
    mainStatus.pwm[0] = (this.bitsState[1] & (1 << (46 - 32))) !== 0 ? 128 : 0;

    let axisDone = 0;
    const position: Axes8 = createZeroAxes8();
    const dest: Axes8 = createZeroAxes8();

    for (let i = 0; i < AXIS_NAMES.length; i++) {
      const axis = AXIS_NAMES[i]!;
      const destCounts = this.dro[axis] * this.countsPerInch;
      const isMoving =
        this.jogSpeeds[axis] !== 0 ||
        (this.interpreting && Math.abs(this.targetDro[axis] - this.dro[axis]) > 1e-6);
      // Tiny simulated servo following error while moving
      const followingErr = isMoving ? 0.5 : 0;
      const posCounts = destCounts - followingErr;

      mainStatus.dest[i] = destCounts;
      mainStatus.position[i] = posCounts;
      dest[axis] = destCounts;
      position[axis] = posCounts;
      if (!isMoving) {
        axisDone |= 1 << i;
      }
    }
    mainStatus.axisDone = axisDone;

    return {
      dro: cloneAxes8(this.dro),
      position,
      dest,
      currentLine: this.currentLine,
      connected: this.state === 'connected',
      interpreting: this.interpreting,
      simulate: this.simulate,
      offline: this.offline,
      gcodeFile: this.gcodeFile,
      gcodeFileTimestamp: this.storage.getTimestamp(this.gcodeFile),
      settingsFile: this.settingsFile,
      settingsFileTimestamp: this.storage.getTimestamp(this.settingsFile),
      timeStamp: mainStatus.timeStamp,
      mainStatus,
    };
  }

  private emitStatus(): void {
    const status = this.buildStatus();
    for (const listener of this.statusListeners) {
      listener(status);
    }
  }

  async invoke<TParams = unknown>(
    action: string,
    params: unknown = null,
  ): Promise<KmxRpcResponse<TParams>> {
    this.emitRawLog('out', `MOCK invoke ${action} ${JSON.stringify(params)}`);

    if (
      this.offline &&
      action !== 'setGcodeFile' &&
      action !== 'onUpdateMotionParams' &&
      action !== 'onGetCapabilities'
    ) {
      throw new Error(`RPC ${action} failed (403): Motion API disabled in offline preview`);
    }

    let ret = 0;
    switch (action) {
      case 'onCycleStart':
        this.reloadGcodeLines();
        if (this.currentLine >= this.gcodeLines.length) {
          this.currentLine = 0;
        }
        this.stopImmediateState = 0;
        this.interpreting = true;
        this.stepMode = false;
        this.emitControl({
          type: CB_CONSOLE,
          block: false,
          message: `Cycle Start (${this.gcodeFile})`,
        });
        break;

      case 'onStep':
        this.reloadGcodeLines();
        if (this.currentLine >= this.gcodeLines.length) {
          this.currentLine = 0;
        }
        this.stopImmediateState = 0;
        this.interpreting = true;
        this.stepMode = true;
        this.tick(0.1);
        break;

      case 'onHalt':
        this.interpreting = false;
        this.stepMode = false;
        this.jogSpeeds = createZeroAxes8();
        this.targetDro = cloneAxes8(this.dro);
        this.emitControl({
          type: CB_COMPLETE,
          block: false,
          line: this.currentLine,
          status: 1005,
          sequence: 0,
          message: 'Halted by user',
        });
        break;

      case 'onFeedhold':
        this.stopImmediateState = this.stopImmediateState === 0 ? 1 : 0;
        this.emitControl({
          type: CB_CONSOLE,
          block: false,
          message: this.stopImmediateState ? 'Feed Hold active' : 'Feed Hold resumed',
        });
        break;

      case 'onReset':
        this.interpreting = false;
        this.stepMode = false;
        this.stopImmediateState = 0;
        this.jogSpeeds = createZeroAxes8();
        this.currentLine = 0;
        this.enables = 0b00001111;
        this.emitControl({
          type: CB_CONSOLE,
          block: false,
          message: 'Controller reset',
        });
        break;

      case 'onEmergencyStop':
        this.interpreting = false;
        this.stepMode = false;
        this.stopImmediateState = 0;
        this.jogSpeeds = createZeroAxes8();
        this.targetDro = cloneAxes8(this.dro);
        this.enables = 0;
        // Clear KFLOP threads 2..7 (keep thread 1 if init)
        this.threadActive &= 0b00000010;
        this.bitsState[1] &= ~(1 << (46 - 32));
        this.emitControl({
          type: CB_ERR_MSG,
          block: false,
          message: 'EMERGENCY STOP triggered — all axes disabled',
        });
        break;

      case 'onSimulate':
        this.simulate = !this.simulate;
        this.emitControl({
          type: CB_CONSOLE,
          block: false,
          message: `Simulate mode ${this.simulate ? 'ON' : 'OFF'}`,
        });
        break;

      case 'onUpdateMotionParams':
        this.emitControl({
          type: CB_CONSOLE,
          block: false,
          message: 'Motion parameters updated',
        });
        break;

      case 'onInvokeAction': {
        const idx = typeof params === 'number' ? params : Number(params ?? 0);
        // Toggle thread 2 briefly to show live thread activity
        this.threadActive |= 1 << 2;
        this.emitControl({
          type: CB_CONSOLE,
          block: false,
          message: `Invoked user action #${idx}`,
        });
        // If action looks like Enable (index 11 or 12 in KMotionCNC), re-enable axes
        if (this.enables === 0) {
          this.enables = 0b00001111;
        }
        break;
      }

      case 'setGcodeFile': {
        const path = String(params ?? '');
        this.gcodeFile = path.replace(/^\/+/, '');
        this.currentLine = 0;
        this.reloadGcodeLines();
        break;
      }

      case 'jog': {
        if (Array.isArray(params) && params.length >= 2) {
          const axisIdx = Number(params[0]);
          const speed = Number(params[1]);
          const axisName = AXIS_NAMES[axisIdx];
          if (axisName) {
            this.jogSpeeds[axisName] = speed;
          }
        }
        break;
      }

      case 'onMdi': {
        if (this.interpreting) {
          ret = -1;
          break;
        }
        const gcode = String(params ?? '');
        this.parseAndApplyGcodeLine(gcode);
        this.dro = cloneAxes8(this.targetDro);
        this.emitControl({
          type: CB_CONSOLE,
          block: false,
          message: `MDI: ${gcode}`,
        });
        break;
      }

      case 'onSetFixture': {
        if (this.interpreting) {
          ret = -1;
          break;
        }
        const fixture = Number(params ?? 1);
        if (fixture >= 1 && fixture <= 9) {
          this.activeFixture = fixture;
        } else {
          ret = -1;
        }
        break;
      }

      case 'onSetOrigin': {
        if (this.interpreting || !Array.isArray(params) || params.length < 7) {
          ret = -1;
          break;
        }
        const index = Number(params[0]);
        const origin = createZeroAxes8();
        for (let i = 0; i < AXIS_NAMES.length && i + 1 < params.length; i++) {
          const axis = AXIS_NAMES[i]!;
          origin[axis] = Number(params[i + 1] ?? 0);
        }
        this.origins[index] = origin;
        break;
      }

      case 'onDoErrorMessage':
        this.emitControl({
          type: CB_ERR_MSG,
          block: false,
          message: String(params ?? ''),
        });
        break;

      default:
        break;
    }

    this.emitStatus();
    return { api: 'kmx', func: action, ret };
  }

  async jog(axis: number, speed: number): Promise<void> {
    await this.invoke('jog', [Math.trunc(axis), Math.trunc(speed)]);
  }

  async sendMdi(gcode: string): Promise<KmxRpcResponse> {
    return this.invoke('onMdi', gcode);
  }

  async setFixture(fixture: number): Promise<KmxRpcResponse> {
    return this.invoke('onSetFixture', Math.trunc(fixture));
  }

  async setOrigin(index: number, coords: number[]): Promise<KmxRpcResponse> {
    return this.invoke('onSetOrigin', [Math.trunc(index), ...coords]);
  }

  async setGcodeFile(path: string): Promise<KmxRpcResponse> {
    return this.invoke('setGcodeFile', path);
  }

  acknowledgeCallback(id: number, returnValue: number): void {
    this.lastAck = { id, returnValue };
    this.emitRawLog('out', `MOCK CB_ACK id=${id} returnValue=${returnValue}`);
  }

  getActiveFixture(): number {
    return this.activeFixture;
  }

  getOrigin(index: number): Axes8 | undefined {
    return this.origins[index];
  }

  onStatus(listener: (status: KmxStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  onMessage(listener: (message: ControlMessage) => void): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  onConnectionState(listener: (state: ConnectionState, error?: string) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  onRawLog(listener: (entry: RawLogEntry) => void): () => void {
    this.rawLogListeners.add(listener);
    return () => this.rawLogListeners.delete(listener);
  }
}
