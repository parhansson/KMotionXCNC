import { createStore, type StoreApi } from 'zustand/vanilla';
import {
  createEmptyMainStatus,
  createZeroAxes8,
  type Axes8,
  type BackendCapabilities,
  type ConnectionState,
  type ControlMessage,
  type KmxMainStatus,
  type RawLogEntry,
} from '@kmxcnc/kmx-protocol';
import type { MachineState } from './fsm';
import type { MachineConfig } from './schemas';
import type { LengthUnit } from './units';

export const FIXTURE_NAMES = [
  'G54',
  'G55',
  'G56',
  'G57',
  'G58',
  'G59',
  'G59.1',
  'G59.2',
  'G59.3',
] as const;

export type FixtureName = (typeof FIXTURE_NAMES)[number];

export function fixtureIndexToName(index: number): FixtureName {
  return FIXTURE_NAMES[index - 1] ?? 'G54';
}

export function fixtureNameToIndex(name: FixtureName): number {
  const idx = FIXTURE_NAMES.indexOf(name);
  return idx >= 0 ? idx + 1 : 1;
}

export type ConnectionMode = 'mock' | 'local' | 'lan';

export interface ConnectionConfig {
  mode: ConnectionMode;
  baseUrl: string;
  authToken?: string;
}

export interface DroState {
  /** Machine coordinates in canonical mm (deg for rotary). */
  machinePos: Axes8;
  /** Work coordinates (machinePos - active fixture offset) in canonical mm (deg for rotary). */
  workPos: Axes8;
  /** Commanded destination in canonical mm (deg for rotary). */
  destPos: Axes8;
  /** Following error (dest - actual) in canonical mm (deg for rotary). */
  followingError: Axes8;
  coordMode: 'machine' | 'work';
  fixture: FixtureName;
  fixtureIndex: number;
  diameterMode: boolean;
  workOffsets: Record<FixtureName, Axes8>;
}

export interface ModalState {
  distanceMode: 'G90' | 'G91';
  units: 'G20' | 'G21';
  plane: 'G17' | 'G18' | 'G19';
  activeTool: number;
  feedRate: number;
  spindleSpeed: number;
  spindleState: 'off' | 'cw' | 'ccw';
}

export interface OverridesState {
  /** Feed rate override multiplier (1.0 = 100%). */
  fro: number;
  /** Spindle speed override multiplier (1.0 = 100%). */
  sso: number;
}

export interface GcodeBufferState {
  filename: string;
  text: string;
  dirty: boolean;
  currentLine: number;
  selectedLine: number | null;
  timestamp: number;
}

export interface LogEntry {
  id: number;
  timestamp: number;
  message: string;
  line?: number;
  status?: number;
}

export interface LogsState {
  console: LogEntry[];
  error: LogEntry[];
  status: LogEntry[];
  raw: RawLogEntry[];
}

export interface PreflightViolation {
  axis: string;
  limit: 'min' | 'max';
  valueMm: number;
  limitMm: number;
  message: string;
}

export interface PreflightSummary {
  ok: boolean;
  rapidDistanceMm: number;
  cutDistanceMm: number;
  estimatedTimeSec: number;
  boundsMin: Partial<Axes8>;
  boundsMax: Partial<Axes8>;
  violations: PreflightViolation[];
  warnings: string[];
}

export interface ActiveClientControl {
  hasControl: boolean;
  clientId: string;
  mode: 'control' | 'monitor';
}

export interface CncState {
  connectionConfig: ConnectionConfig;
  connectionState: ConnectionState;
  connectionError: string | null;
  capabilities: BackendCapabilities | null;
  machineState: MachineState;
  simulate: boolean;
  blockDelete: boolean;
  displayUnit: LengthUnit;
  dro: DroState;
  enables: number;
  axisDone: number;
  threadActive: number;
  mainStatus: KmxMainStatus;
  modalState: ModalState;
  overrides: OverridesState;
  gcode: GcodeBufferState;
  machineConfig: MachineConfig | null;
  logs: LogsState;
  pendingCallbacks: ControlMessage[];
  pendingCallback: ControlMessage | null;
  preflightSummary: PreflightSummary | null;
  activeClientControl: ActiveClientControl;
}

export interface CncStoreActions {
  setConnectionConfig(config: Partial<ConnectionConfig>): void;
  setConnectionState(state: ConnectionState, error?: string | null): void;
  setCapabilities(capabilities: BackendCapabilities | null): void;
  setMachineState(state: MachineState): void;
  setSimulate(simulate: boolean): void;
  setBlockDelete(blockDelete: boolean): void;
  setDisplayUnit(unit: LengthUnit): void;
  setDro(patch: Partial<DroState>): void;
  setMainStatus(mainStatus: KmxMainStatus, enables: number, axisDone: number, threadActive: number): void;
  setModalState(patch: Partial<ModalState>): void;
  setOverrides(patch: Partial<OverridesState>): void;
  setGcode(patch: Partial<GcodeBufferState>): void;
  setMachineConfig(config: MachineConfig | null): void;
  appendLog(stream: 'console' | 'error' | 'status', message: string, meta?: { line?: number; status?: number }): void;
  appendRawLog(entry: RawLogEntry): void;
  clearLogs(stream?: 'console' | 'error' | 'status' | 'raw'): void;
  enqueueCallback(msg: ControlMessage): void;
  dequeueCallback(id?: number): void;
  setPreflightSummary(summary: PreflightSummary | null): void;
  setActiveClientControl(patch: Partial<ActiveClientControl>): void;
}

export type CncStoreState = CncState & CncStoreActions;
export type CncStore = StoreApi<CncStoreState>;

const MAX_LOG_ENTRIES = 500;

function createInitialWorkOffsets(): Record<FixtureName, Axes8> {
  const offsets = {} as Record<FixtureName, Axes8>;
  for (const name of FIXTURE_NAMES) {
    offsets[name] = createZeroAxes8();
  }
  return offsets;
}

function createClientId(): string {
  return `kmx-${Math.random().toString(36).slice(2, 10)}`;
}

export function createCncStore(initialConfig?: Partial<ConnectionConfig>): CncStore {
  let nextLogId = 1;

  return createStore<CncStoreState>((set) => ({
    connectionConfig: {
      mode: initialConfig?.mode ?? 'mock',
      baseUrl: initialConfig?.baseUrl ?? '',
      authToken: initialConfig?.authToken,
    },
    connectionState: 'disconnected',
    connectionError: null,
    capabilities: null,
    machineState: 'disconnected',
    simulate: false,
    blockDelete: false,
    displayUnit: 'mm',
    dro: {
      machinePos: createZeroAxes8(),
      workPos: createZeroAxes8(),
      destPos: createZeroAxes8(),
      followingError: createZeroAxes8(),
      coordMode: 'work',
      fixture: 'G54',
      fixtureIndex: 1,
      diameterMode: false,
      workOffsets: createInitialWorkOffsets(),
    },
    enables: 0,
    axisDone: 0,
    threadActive: 0,
    mainStatus: createEmptyMainStatus(),
    modalState: {
      distanceMode: 'G90',
      units: 'G21',
      plane: 'G17',
      activeTool: 1,
      feedRate: 0,
      spindleSpeed: 0,
      spindleState: 'off',
    },
    overrides: {
      fro: 1.0,
      sso: 1.0,
    },
    gcode: {
      filename: '',
      text: '',
      dirty: false,
      currentLine: -1,
      selectedLine: null,
      timestamp: 0,
    },
    machineConfig: null,
    logs: {
      console: [],
      error: [],
      status: [],
      raw: [],
    },
    pendingCallbacks: [],
    pendingCallback: null,
    preflightSummary: null,
    activeClientControl: {
      hasControl: true,
      clientId: createClientId(),
      mode: 'control',
    },

    setConnectionConfig(config) {
      set((s) => ({
        connectionConfig: { ...s.connectionConfig, ...config },
      }));
    },

    setConnectionState(connectionState, error = null) {
      set({ connectionState, connectionError: error ?? null });
    },

    setCapabilities(capabilities) {
      set({ capabilities });
    },

    setMachineState(machineState) {
      set({ machineState });
    },

    setSimulate(simulate) {
      set({ simulate });
    },

    setBlockDelete(blockDelete) {
      set({ blockDelete });
    },

    setDisplayUnit(displayUnit) {
      set({ displayUnit });
    },

    setDro(patch) {
      set((s) => ({ dro: { ...s.dro, ...patch } }));
    },

    setMainStatus(mainStatus, enables, axisDone, threadActive) {
      set({ mainStatus, enables, axisDone, threadActive });
    },

    setModalState(patch) {
      set((s) => ({ modalState: { ...s.modalState, ...patch } }));
    },

    setOverrides(patch) {
      set((s) => ({ overrides: { ...s.overrides, ...patch } }));
    },

    setGcode(patch) {
      set((s) => ({ gcode: { ...s.gcode, ...patch } }));
    },

    setMachineConfig(machineConfig) {
      set({ machineConfig });
    },

    appendLog(stream, message, meta) {
      const entry: LogEntry = {
        id: nextLogId++,
        timestamp: Date.now(),
        message,
        line: meta?.line,
        status: meta?.status,
      };
      set((s) => {
        const list = s.logs[stream];
        const next = list.length >= MAX_LOG_ENTRIES ? [...list.slice(-(MAX_LOG_ENTRIES - 1)), entry] : [...list, entry];
        return { logs: { ...s.logs, [stream]: next } };
      });
    },

    appendRawLog(entry) {
      set((s) => {
        const list = s.logs.raw;
        const next = list.length >= MAX_LOG_ENTRIES ? [...list.slice(-(MAX_LOG_ENTRIES - 1)), entry] : [...list, entry];
        return { logs: { ...s.logs, raw: next } };
      });
    },

    clearLogs(stream) {
      set((s) => {
        if (!stream) {
          return { logs: { console: [], error: [], status: [], raw: [] } };
        }
        return { logs: { ...s.logs, [stream]: [] } };
      });
    },

    enqueueCallback(msg) {
      set((s) => {
        const pendingCallbacks = [...s.pendingCallbacks, msg];
        return {
          pendingCallbacks,
          pendingCallback: pendingCallbacks[0] ?? null,
        };
      });
    },

    dequeueCallback(id) {
      set((s) => {
        const pendingCallbacks =
          id === undefined
            ? s.pendingCallbacks.slice(1)
            : s.pendingCallbacks.filter((c) => c.id !== id);
        return {
          pendingCallbacks,
          pendingCallback: pendingCallbacks[0] ?? null,
        };
      });
    },

    setPreflightSummary(preflightSummary) {
      set({ preflightSummary });
    },

    setActiveClientControl(patch) {
      set((s) => ({
        activeClientControl: { ...s.activeClientControl, ...patch },
      }));
    },
  }));
}
