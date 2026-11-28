import {
  AXIS_NAMES,
  CB_COMPLETE,
  CB_CONSOLE,
  CB_ERR_MSG,
  CB_MESSAGEBOX,
  CB_STATUS,
  CB_USER,
  CB_USER_M_CODE,
  axisNameToIndex,
  createZeroAxes8,
  type Axes8,
  type AxisName,
  type ConnectionState,
  type ControlMessage,
  type FileStorage,
  type KmxStatus,
  type KmxTransport,
} from '@kmxcnc/kmx-protocol';
import { canExecute, deriveMachineState, getCommandBlockReason, type CncCommand } from './fsm';
import { parseMachineConfig, type MachineConfig } from './schemas';
import {
  createCncStore,
  fixtureIndexToName,
  fixtureNameToIndex,
  type CncStore,
  type FixtureName,
} from './store';
import {
  DEFAULT_ROTARY_AXES,
  controllerAxesToMm,
  inchesToMm,
  mmToInches,
  type LengthUnit,
} from './units';

/**
 * Offset in KMotionX `Interpreter->McodeActions[]` where `userActions[0..9]` begin.
 * See `WebController.cpp`: M2-M9/S = 2..10, userButtons = 11..20, M100-M119 = 21..40, Special = 41..48.
 */
export const USER_BUTTON_ACTION_OFFSET = 11;

export interface CncControllerOptions {
  transport: KmxTransport;
  storage: FileStorage;
  store?: CncStore;
  /** Interval in ms for deadman jog heartbeat refreshes (default: 150ms). */
  jogHeartbeatMs?: number;
}

interface ActiveJogEntry {
  axis: AxisName;
  axisIndex: number;
  speed: number;
  timer: ReturnType<typeof setInterval>;
}

export class CncController {
  readonly store: CncStore;
  private transport: KmxTransport;
  private storage: FileStorage;
  private readonly jogHeartbeatMs: number;

  private unsubscribers: Array<() => void> = [];
  private activeJogs = new Map<AxisName, ActiveJogEntry>();
  private froTimer: ReturnType<typeof setTimeout> | null = null;
  private ssoTimer: ReturnType<typeof setTimeout> | null = null;
  private estopLatched = false;
  private haltedLatched = false;
  private lastLoadedGcodeKey = '';
  private lastLoadedSettingsKey = '';
  private latestStatus: KmxStatus | null = null;
  private blurCleanup: (() => void) | null = null;

  constructor(options: CncControllerOptions) {
    this.transport = options.transport;
    this.storage = options.storage;
    this.store = options.store ?? createCncStore();
    this.jogHeartbeatMs = options.jogHeartbeatMs ?? 150;

    this.bindTransport(this.transport);
    this.attachSafetyWindowListeners();
  }

  getTransport(): KmxTransport {
    return this.transport;
  }

  getStorage(): FileStorage {
    return this.storage;
  }

  /**
   * Swaps the underlying transport & storage (e.g., switching between Simulator and LAN kmxWeb).
   * Guarantees all active jogs are stopped before disconnecting the previous transport.
   */
  async setTransport(transport: KmxTransport, storage: FileStorage): Promise<void> {
    await this.stopAllJogs();
    await this.disconnect();
    this.unbindTransport();
    this.transport = transport;
    this.storage = storage;
    this.lastLoadedGcodeKey = '';
    this.lastLoadedSettingsKey = '';
    this.latestStatus = null;
    this.estopLatched = false;
    this.haltedLatched = false;
    this.bindTransport(transport);
  }

  private bindTransport(transport: KmxTransport): void {
    this.unbindTransport();
    this.unsubscribers.push(
      transport.onStatus((status) => this.handleStatus(status)),
      transport.onMessage((msg) => this.handleControlMessage(msg)),
      transport.onConnectionState((state, error) => this.handleConnectionState(state, error)),
      transport.onRawLog((entry) => this.store.getState().appendRawLog(entry)),
    );
  }

  private unbindTransport(): void {
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];
  }

  private attachSafetyWindowListeners(): void {
    if (typeof globalThis.addEventListener !== 'function') return;
    const onBlurOrHide = () => {
      if (this.activeJogs.size > 0) {
        void this.stopAllJogs();
      }
    };
    const onVisibility = () => {
      if (typeof document !== 'undefined' && document.hidden && this.activeJogs.size > 0) {
        void this.stopAllJogs();
      }
    };
    globalThis.addEventListener('blur', onBlurOrHide);
    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      document.addEventListener('visibilitychange', onVisibility);
    }
    this.blurCleanup = () => {
      globalThis.removeEventListener('blur', onBlurOrHide);
      if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
    };
  }

  dispose(): void {
    if (this.froTimer !== null) {
      clearTimeout(this.froTimer);
      this.froTimer = null;
    }
    if (this.ssoTimer !== null) {
      clearTimeout(this.ssoTimer);
      this.ssoTimer = null;
    }
    void this.stopAllJogs();
    this.unbindTransport();
    if (this.blurCleanup) {
      this.blurCleanup();
      this.blurCleanup = null;
    }
  }

  async connect(): Promise<void> {
    this.estopLatched = false;
    this.haltedLatched = false;
    await this.transport.connect();
    try {
      const caps = await this.transport.getCapabilities();
      this.store.getState().setCapabilities(caps);
    } catch {
      // Capabilities optional on legacy backends
    }
  }

  async disconnect(): Promise<void> {
    await this.stopAllJogs();
    await this.transport.disconnect();
    this.latestStatus = null;
    this.store.getState().setMachineState('disconnected');
  }

  private getRotaryAxes(): ReadonlySet<AxisName> {
    const cfg = this.store.getState().machineConfig;
    if (!cfg) return DEFAULT_ROTARY_AXES;
    const rotary = new Set<AxisName>();
    for (const axis of cfg.axes) {
      if (axis.degrees === true) {
        rotary.add(axis.name);
      } else if (
        axis.degrees === undefined &&
        (axis.name === 'A' || axis.name === 'B' || axis.name === 'C')
      ) {
        rotary.add(axis.name);
      }
    }
    return rotary;
  }

  private handleConnectionState(state: ConnectionState, error?: string): void {
    const s = this.store.getState();
    s.setConnectionState(state, error ?? null);
    if (state !== 'connected') {
      // Immediately clear active jog timers on disconnect; lock motion
      this.clearAllJogTimersOnly();
      s.setMachineState('disconnected');
    }
  }

  private handleStatus(status: KmxStatus): void {
    this.latestStatus = status;
    const s = this.store.getState();
    const rotary = this.getRotaryAxes();

    // Clear estop latch if axes become enabled again
    if (this.estopLatched && status.mainStatus.enables !== 0) {
      this.estopLatched = false;
    }
    if (status.interpreting) {
      this.haltedLatched = false;
    }

    // WebController::UpdateClient() calls ConvertAbsoluteToMachine(), which converts inches
    // into the interpreter's active length_units (G20=inches, G21=mm). Avoid double-scaling by 25.4!
    const machinePos =
      status.lengthUnits === 'mm'
        ? { ...status.dro }
        : controllerAxesToMm(status.dro, rotary);
    if (status.lengthUnits || status.distanceMode) {
      const nextUnits = status.lengthUnits === 'mm' ? 'G21' : status.lengthUnits === 'in' ? 'G20' : s.modalState.units;
      const nextDist = status.distanceMode ?? s.modalState.distanceMode;
      if (nextUnits !== s.modalState.units || nextDist !== s.modalState.distanceMode) {
        s.setModalState({ units: nextUnits, distanceMode: nextDist });
      }
    }
    if (status.blockDelete !== undefined && status.blockDelete !== s.blockDelete) {
      s.setBlockDelete(status.blockDelete);
    }
    const activeOffset = s.dro.workOffsets[s.dro.fixture];
    const workPos = createZeroAxes8();
    const destPos = createZeroAxes8();
    const followingError = createZeroAxes8();

    const axisConfigs = s.machineConfig?.axes ?? [];
    for (let i = 0; i < AXIS_NAMES.length; i++) {
      const axis = AXIS_NAMES[i]!;
      workPos[axis] = machinePos[axis] - activeOffset[axis];
      const axisCfg = axisConfigs.find((a) => a.name === axis);
      const cpi = axisCfg?.countsPerUnit && axisCfg.countsPerUnit > 0 ? axisCfg.countsPerUnit : 0;
      const errCounts = status.dest[axis] - status.position[axis];
      if (cpi > 0) {
        const errUnits = errCounts / cpi;
        followingError[axis] = rotary.has(axis) ? errUnits : inchesToMm(errUnits);
        const destUnits = status.dest[axis] / cpi;
        destPos[axis] = rotary.has(axis) ? destUnits : inchesToMm(destUnits);
      } else {
        followingError[axis] = errCounts;
        destPos[axis] = machinePos[axis];
      }
    }

    s.setDro({ machinePos, workPos, destPos, followingError });
    s.setMainStatus(
      status.mainStatus,
      status.mainStatus.enables,
      status.mainStatus.axisDone,
      status.mainStatus.threadActive,
    );
    s.setSimulate(status.simulate);

    const nextState = deriveMachineState({
      connectionState: s.connectionState,
      status,
      previousState: s.machineState,
      estopLatched: this.estopLatched,
      haltedLatched: this.haltedLatched,
    });
    if (nextState !== s.machineState) {
      s.setMachineState(nextState);
    }

    if (status.currentLine !== s.gcode.currentLine) {
      s.setGcode({ currentLine: status.currentLine });
    }

    // Auto-load settings/machine.json when backend reports a new file or timestamp
    if (status.settingsFile) {
      const settingsKey = `${status.settingsFile}:${status.settingsFileTimestamp}`;
      if (settingsKey !== this.lastLoadedSettingsKey) {
        this.lastLoadedSettingsKey = settingsKey;
        void this.loadMachineConfig(status.settingsFile).catch(() => {
          // Non-fatal if settings file cannot be fetched immediately
        });
      }
    }

    // Auto-load active G-code file when backend reports a new file or timestamp (unless user has unsaved edits)
    if (status.gcodeFile) {
      const gcodeKey = `${status.gcodeFile}:${status.gcodeFileTimestamp}`;
      if (gcodeKey !== this.lastLoadedGcodeKey && !s.gcode.dirty) {
        this.lastLoadedGcodeKey = gcodeKey;
        void this.loadGcodeFile(status.gcodeFile, false).catch(() => {
          // Non-fatal
        });
      }
    }
  }

  private handleControlMessage(msg: ControlMessage): void {
    const s = this.store.getState();
    const { payload } = msg;

    // kmxWeb MessageQueue holds EVERY callback in CBS_WAITING and resends every 30s until ACKed.
    // Non-blocking messages (block === false) must be ACKed immediately on receipt;
    // blocking messages (block === true) are ACKed when the user responds in CallbackModal.
    if (!payload.block) {
      this.transport.acknowledgeCallback(msg.id, 0);
    }

    switch (payload.type) {
      case CB_STATUS:
        s.appendLog('status', `Line ${payload.line}: ${payload.message}`, { line: payload.line });
        break;
      case CB_COMPLETE:
        s.appendLog(
          'status',
          `Complete line ${payload.line} (status ${payload.status}): ${payload.message}`,
          { line: payload.line, status: payload.status },
        );
        if (payload.status === 1005) {
          this.haltedLatched = true;
          if (this.latestStatus) {
            const nextState = deriveMachineState({
              connectionState: s.connectionState,
              status: this.latestStatus,
              previousState: s.machineState,
              estopLatched: this.estopLatched,
              haltedLatched: this.haltedLatched,
            });
            s.setMachineState(nextState);
          }
        }
        break;
      case CB_ERR_MSG:
        s.appendLog('error', payload.message);
        break;
      case CB_CONSOLE:
        s.appendLog('console', payload.message);
        break;
      case CB_USER:
      case CB_USER_M_CODE:
      case CB_MESSAGEBOX:
        // Queue for non-blocking UI modal
        s.enqueueCallback(msg);
        break;
    }
  }

  /**
   * Acknowledges the active blocking interpreter callback (`USER`, `USER_M_CODE`, `MESSAGEBOX`).
   */
  acknowledgePendingCallback(returnValue: number, id?: number): void {
    const s = this.store.getState();
    const target =
      id !== undefined
        ? s.pendingCallbacks.find((c) => c.id === id)
        : s.pendingCallback;
    if (!target) return;
    if (target.payload.block) {
      this.transport.acknowledgeCallback(target.id, returnValue);
    }
    s.dequeueCallback(target.id);
  }

  canExecute(cmd: CncCommand): boolean {
    const s = this.store.getState();
    if (!s.activeClientControl.hasControl && cmd !== 'loadGcode') {
      return false;
    }
    return canExecute(s.machineState, cmd);
  }

  private assertCanExecute(cmd: CncCommand): void {
    const s = this.store.getState();
    if (!s.activeClientControl.hasControl && cmd !== 'loadGcode') {
      throw new Error('This client is in monitor-only mode and does not hold active control.');
    }
    const reason = getCommandBlockReason(s.machineState, cmd);
    if (reason) {
      throw new Error(reason);
    }
  }

  async cycleStart(): Promise<void> {
    this.assertCanExecute('cycleStart');
    await this.stopAllJogs();
    const s = this.store.getState();
    if (s.gcode.dirty && s.gcode.text.trim().length > 0 && canExecute(s.machineState, 'saveGcode')) {
      await this.saveGcodeFile(s.gcode.filename || 'gcode/unsaved.ngc', s.gcode.text);
    }
    this.haltedLatched = false;
    await this.transport.invoke('onCycleStart');
  }

  async halt(): Promise<void> {
    this.assertCanExecute('halt');
    await this.stopAllJogs();
    this.haltedLatched = true;
    await this.transport.invoke('onHalt');
  }

  async feedHold(): Promise<void> {
    this.assertCanExecute('feedHold');
    await this.stopAllJogs();
    await this.transport.invoke('onFeedhold');
  }

  async resume(): Promise<void> {
    this.assertCanExecute('resume');
    await this.transport.invoke('onFeedhold');
  }

  async step(): Promise<void> {
    this.assertCanExecute('step');
    await this.stopAllJogs();
    const s = this.store.getState();
    if (s.gcode.dirty && s.gcode.text.trim().length > 0 && canExecute(s.machineState, 'saveGcode')) {
      await this.saveGcodeFile(s.gcode.filename || 'gcode/unsaved.ngc', s.gcode.text);
    }
    await this.transport.invoke('onStep');
  }

  async reset(): Promise<void> {
    this.assertCanExecute('reset');
    await this.stopAllJogs();
    this.estopLatched = false;
    this.haltedLatched = false;
    await this.transport.invoke('onReset');
  }

  async emergencyStop(): Promise<void> {
    this.assertCanExecute('estop');
    await this.stopAllJogs();
    this.estopLatched = true;
    this.haltedLatched = false;
    this.store.getState().setMachineState('estop');
    await this.transport.invoke('onEmergencyStop');
  }

  async toggleSimulate(): Promise<void> {
    this.assertCanExecute('toggleSimulate');
    await this.transport.invoke('onSimulate');
  }

  async setBlockDelete(enabled: boolean): Promise<void> {
    this.store.getState().setBlockDelete(enabled);
    if (this.store.getState().connectionState === 'connected') {
      try {
        await this.transport.invoke('onBlockDelete', enabled ? 1 : 0);
      } catch {
        // Legacy backends without onBlockDelete still keep client-side filtering
      }
    }
  }

  /** Sets Feed Rate Override (factor, 1.0 = 100%) and sends `onSetFro` to backend (throttled for smooth sliders). */
  setFeedRateOverride(factor: number): void {
    const clamped = Math.max(0.05, Math.min(5.0, factor));
    this.store.getState().setOverrides({ fro: clamped });
    if (this.froTimer !== null) clearTimeout(this.froTimer);
    this.froTimer = setTimeout(() => {
      this.froTimer = null;
      const s = this.store.getState();
      if (s.connectionState === 'connected' && s.machineState !== 'offline') {
        void this.transport.invoke('onSetFro', clamped).catch(() => {
          // Legacy backends without onSetFro keep local state
        });
      }
    }, 50);
  }

  /** Sets Spindle Speed Override (factor, 1.0 = 100%) and sends `onSetSso` to backend (throttled for smooth sliders). */
  setSpindleRateOverride(factor: number): void {
    const clamped = Math.max(0.05, Math.min(5.0, factor));
    this.store.getState().setOverrides({ sso: clamped });
    if (this.ssoTimer !== null) clearTimeout(this.ssoTimer);
    this.ssoTimer = setTimeout(() => {
      this.ssoTimer = null;
      const s = this.store.getState();
      if (s.connectionState === 'connected' && s.machineState !== 'offline') {
        void this.transport.invoke('onSetSso', clamped).catch(() => {
          // Legacy backends without onSetSso keep local state
        });
      }
    }, 50);
  }

  async invokeUserAction(actionIndex: number): Promise<number> {
    this.assertCanExecute('invokeAction');
    const res = await this.transport.invoke('onInvokeAction', actionIndex);
    return res.ret;
  }

  /** Invoke a 0-based `machine.json` `userActions[buttonIndex]` entry (maps to KMotionX McodeActions[11 + buttonIndex]). */
  async invokeUserButton(buttonIndex: number): Promise<number> {
    return this.invokeUserAction(USER_BUTTON_ACTION_OFFSET + buttonIndex);
  }

  async sendMdi(gcode: string): Promise<number> {
    this.assertCanExecute('mdi');
    const trimmed = gcode.trim();
    if (!trimmed) return 0;
    const res = await this.transport.sendMdi(trimmed);
    return res.ret;
  }

  // --- Deadman Jogging ---

  async startJog(axis: AxisName, speed: number): Promise<void> {
    this.assertCanExecute('jog');
    const axisIndex = axisNameToIndex(axis);
    if (axisIndex < 0) {
      throw new Error(`Invalid axis: ${axis}`);
    }
    if (speed === 0) {
      await this.stopJog(axis);
      return;
    }

    // Clear existing timer for this axis if changing direction/speed
    const existing = this.activeJogs.get(axis);
    if (existing) {
      clearInterval(existing.timer);
      this.activeJogs.delete(axis);
    }

    await this.transport.jog(axisIndex, speed);

    const timer = setInterval(() => {
      if (this.store.getState().connectionState !== 'connected') {
        this.clearAllJogTimersOnly();
        return;
      }
      void this.transport.jog(axisIndex, speed).catch(() => {
        this.clearJogTimerOnly(axis);
      });
    }, this.jogHeartbeatMs);

    this.activeJogs.set(axis, { axis, axisIndex, speed, timer });
  }

  async stopJog(axis?: AxisName): Promise<void> {
    if (axis === undefined) {
      await this.stopAllJogs();
      return;
    }
    const existing = this.activeJogs.get(axis);
    if (existing) {
      clearInterval(existing.timer);
      this.activeJogs.delete(axis);
    }
    const axisIndex = axisNameToIndex(axis);
    if (axisIndex >= 0 && this.store.getState().connectionState === 'connected') {
      try {
        await this.transport.jog(axisIndex, 0);
      } catch {
        // Ignore network errors while stopping
      }
    }
  }

  async stopAllJogs(): Promise<void> {
    const entries = Array.from(this.activeJogs.values());
    this.activeJogs.clear();
    for (const entry of entries) {
      clearInterval(entry.timer);
    }
    if (this.store.getState().connectionState !== 'connected') return;
    await Promise.all(
      entries.map((entry) =>
        this.transport.jog(entry.axisIndex, 0).catch(() => {
          // Best-effort stop on disconnect
        }),
      ),
    );
  }

  private clearJogTimerOnly(axis: AxisName): void {
    const existing = this.activeJogs.get(axis);
    if (existing) {
      clearInterval(existing.timer);
      this.activeJogs.delete(axis);
    }
  }

  private clearAllJogTimersOnly(): void {
    for (const entry of this.activeJogs.values()) {
      clearInterval(entry.timer);
    }
    this.activeJogs.clear();
  }

  getActiveJogAxes(): AxisName[] {
    return Array.from(this.activeJogs.keys());
  }

  async stepJog(axis: AxisName, distanceMm: number, feedMmPerMin = 600): Promise<void> {
    this.assertCanExecute('stepJog');
    const s = this.store.getState();
    const restoreDistanceMode = s.modalState.distanceMode;
    const restoreUnits = s.modalState.units;
    const cmd = `G91 G21 G1 ${axis}${distanceMm.toFixed(4)} F${Math.max(1, Math.round(feedMmPerMin))}`;
    await this.transport.sendMdi(cmd);
    if (restoreDistanceMode !== 'G91' || restoreUnits !== 'G21') {
      await this.transport.sendMdi(`${restoreDistanceMode} ${restoreUnits}`);
    }
  }

  // --- DRO, Coordinates & Fixtures ---

  setCoordMode(coordMode: 'machine' | 'work'): void {
    this.store.getState().setDro({ coordMode });
  }

  setDisplayUnit(unit: LengthUnit): void {
    this.store.getState().setDisplayUnit(unit);
  }

  setDiameterMode(diameterMode: boolean): void {
    this.store.getState().setDro({ diameterMode });
  }

  async setFixture(fixture: FixtureName | number): Promise<void> {
    this.assertCanExecute('setFixture');
    const fixtureIndex = typeof fixture === 'number' ? fixture : fixtureNameToIndex(fixture);
    const fixtureName = fixtureIndexToName(fixtureIndex);
    await this.transport.setFixture(fixtureIndex);
    const s = this.store.getState();
    const offset = s.dro.workOffsets[fixtureName];
    const workPos = createZeroAxes8();
    for (const axis of AXIS_NAMES) {
      workPos[axis] = s.dro.machinePos[axis] - offset[axis];
    }
    s.setDro({ fixture: fixtureName, fixtureIndex, workPos });
  }

  async zeroAxis(axis: AxisName, targetWorkValueMm = 0): Promise<void> {
    this.assertCanExecute('zeroAxis');
    const s = this.store.getState();
    const fixture = s.dro.fixture;
    const currentOffset = { ...s.dro.workOffsets[fixture] };
    currentOffset[axis] = s.dro.machinePos[axis] - targetWorkValueMm;
    const workOffsets = { ...s.dro.workOffsets, [fixture]: currentOffset };
    const workPos = { ...s.dro.workPos, [axis]: targetWorkValueMm };
    s.setDro({ workOffsets, workPos });

    const rotary = this.getRotaryAxes();
    const coords = AXIS_NAMES.map((a) =>
      rotary.has(a) ? currentOffset[a] : mmToInches(currentOffset[a]),
    );
    try {
      await this.transport.setOrigin(s.dro.fixtureIndex, coords);
    } catch {
      // Backends without onSetOrigin still keep client-side work offset
    }
  }

  async zeroAll(): Promise<void> {
    this.assertCanExecute('zeroAll');
    const s = this.store.getState();
    const fixture = s.dro.fixture;
    const newOffset = { ...s.dro.machinePos };
    const workOffsets = { ...s.dro.workOffsets, [fixture]: newOffset };
    s.setDro({ workOffsets, workPos: createZeroAxes8() });

    const rotary = this.getRotaryAxes();
    const coords = AXIS_NAMES.map((a) =>
      rotary.has(a) ? newOffset[a] : mmToInches(newOffset[a]),
    );
    try {
      await this.transport.setOrigin(s.dro.fixtureIndex, coords);
    } catch {
      // Backends without onSetOrigin still keep client-side work offset
    }
  }

  // --- G-code & Machine Settings ---

  async loadGcodeFile(path: string, notifyBackend = true): Promise<string> {
    this.assertCanExecute('loadGcode');
    const text = await this.storage.readFile(path);
    this.store.getState().setGcode({
      filename: path,
      text,
      dirty: false,
      currentLine: 0,
      selectedLine: null,
      timestamp: Date.now(),
    });
    if (notifyBackend && this.store.getState().connectionState === 'connected') {
      await this.transport.setGcodeFile(path);
    }
    return text;
  }

  setGcodeText(text: string, filename?: string): void {
    const s = this.store.getState();
    s.setGcode({
      text,
      filename: filename ?? s.gcode.filename,
      dirty: true,
    });
  }

  async saveGcodeFile(path?: string, text?: string): Promise<void> {
    this.assertCanExecute('saveGcode');
    const s = this.store.getState();
    const targetPath = path ?? s.gcode.filename;
    if (!targetPath) {
      throw new Error('No G-code filename specified');
    }
    const content = text ?? s.gcode.text;
    await this.storage.writeFile(targetPath, content);
    s.setGcode({ filename: targetPath, text: content, dirty: false, timestamp: Date.now() });
    if (this.store.getState().connectionState === 'connected') {
      await this.transport.setGcodeFile(targetPath);
    }
  }

  async loadMachineConfig(path = 'settings/machine.json'): Promise<MachineConfig> {
    const raw = await this.storage.readFile(path);
    const parsed = parseMachineConfig(JSON.parse(raw));
    this.store.getState().setMachineConfig(parsed);
    this.store.getState().setDisplayUnit(parsed.defaultUnit);
    return parsed;
  }

  async saveMachineConfig(config: MachineConfig, path = 'settings/machine.json'): Promise<void> {
    this.assertCanExecute('saveMachineJson');
    const validated = parseMachineConfig(config);
    await this.storage.writeFile(path, JSON.stringify(validated, null, 2));
    this.store.getState().setMachineConfig(validated);
    if (this.store.getState().connectionState === 'connected') {
      await this.transport.invoke('onUpdateMotionParams');
    }
  }
}

export interface KeyboardAdapterOptions {
  /** Slow continuous jog speed in counts/sec (default: 2000). */
  slowSpeed?: number;
  /** Fast continuous jog speed when holding Shift (default: 6000). */
  fastSpeed?: number;
  /** Optional predicate to dynamically enable/disable keyboard jogging. */
  isEnabled?: () => boolean;
  /** Event target (defaults to globalThis / window). */
  target?: Pick<Window, 'addEventListener' | 'removeEventListener'>;
}

const KEY_TO_JOG: Record<string, { axis: AxisName; dir: 1 | -1 }> = {
  ArrowRight: { axis: 'X', dir: 1 },
  ArrowLeft: { axis: 'X', dir: -1 },
  ArrowUp: { axis: 'Y', dir: 1 },
  ArrowDown: { axis: 'Y', dir: -1 },
  PageUp: { axis: 'Z', dir: 1 },
  PageDown: { axis: 'Z', dir: -1 },
};

function isEditableElement(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return false;
  const el = target as { tagName?: string; isContentEditable?: boolean };
  if (el.isContentEditable) return true;
  const tag = el.tagName?.toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

/**
 * Pure keyboard input adapter wired to `CncController`:
 * - Arrow keys: X/Y continuous jog (Shift for fast)
 * - PageUp/PageDown: Z continuous jog
 * - Space: Feed Hold
 * - Escape: Halt / Stop all jogs
 * Automatically stops all jogs on keyup or window blur.
 */
export function createKeyboardAdapter(
  controller: CncController,
  options: KeyboardAdapterOptions = {},
): () => void {
  const slowSpeed = options.slowSpeed ?? 2000;
  const fastSpeed = options.fastSpeed ?? 6000;
  const isEnabled = options.isEnabled ?? (() => true);
  const target = options.target ?? (typeof window !== 'undefined' ? window : undefined);

  if (!target) {
    return () => {};
  }

  const heldKeys = new Map<string, AxisName>();

  const onKeyDown = (event: KeyboardEvent) => {
    if (!isEnabled()) return;
    if (isEditableElement(event.target)) return;

    if (event.code === 'Space') {
      if (controller.canExecute('feedHold')) {
        event.preventDefault();
        void controller.feedHold();
      }
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      void controller.stopAllJogs();
      if (controller.canExecute('halt')) {
        void controller.halt();
      }
      return;
    }

    const mapping = KEY_TO_JOG[event.key];
    if (!mapping) return;
    if (event.repeat || heldKeys.has(event.key)) {
      event.preventDefault();
      return;
    }

    if (!controller.canExecute('jog')) return;
    event.preventDefault();
    heldKeys.set(event.key, mapping.axis);
    const speed = (event.shiftKey ? fastSpeed : slowSpeed) * mapping.dir;
    void controller.startJog(mapping.axis, speed);
  };

  const onKeyUp = (event: KeyboardEvent) => {
    const axis = heldKeys.get(event.key);
    if (!axis) return;
    heldKeys.delete(event.key);
    void controller.stopJog(axis);
  };

  const onBlur = () => {
    if (heldKeys.size > 0) {
      heldKeys.clear();
      void controller.stopAllJogs();
    }
  };

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  target.addEventListener('blur', onBlur);

  return () => {
    heldKeys.clear();
    void controller.stopAllJogs();
    target.removeEventListener('keydown', onKeyDown);
    target.removeEventListener('keyup', onKeyUp);
    target.removeEventListener('blur', onBlur);
  };
}
