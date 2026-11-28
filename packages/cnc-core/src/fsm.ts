import type { ConnectionState, KmxStatus } from '@kmxcnc/kmx-protocol';

export type MachineState =
  | 'disconnected'
  | 'offline'
  | 'idle'
  | 'running'
  | 'halted'
  | 'feedhold'
  | 'estop'
  | 'simulating';

export type CncCommand =
  | 'cycleStart'
  | 'halt'
  | 'feedHold'
  | 'resume'
  | 'step'
  | 'reset'
  | 'estop'
  | 'toggleSimulate'
  | 'jog'
  | 'stepJog'
  | 'mdi'
  | 'zeroAxis'
  | 'zeroAll'
  | 'setFixture'
  | 'setOrigin'
  | 'invokeAction'
  | 'loadGcode'
  | 'saveGcode'
  | 'saveMachineJson'
  | 'updateMotionParams';

const ALLOWED_COMMANDS: Record<MachineState, ReadonlySet<CncCommand>> = {
  disconnected: new Set<CncCommand>(['loadGcode']),
  offline: new Set<CncCommand>([
    'loadGcode',
    'saveGcode',
    'saveMachineJson',
    'updateMotionParams',
  ]),
  idle: new Set<CncCommand>([
    'cycleStart',
    'halt',
    'feedHold',
    'step',
    'reset',
    'estop',
    'toggleSimulate',
    'jog',
    'stepJog',
    'mdi',
    'zeroAxis',
    'zeroAll',
    'setFixture',
    'setOrigin',
    'invokeAction',
    'loadGcode',
    'saveGcode',
    'saveMachineJson',
    'updateMotionParams',
  ]),
  running: new Set<CncCommand>(['estop', 'feedHold', 'halt']),
  simulating: new Set<CncCommand>(['estop', 'feedHold', 'halt']),
  feedhold: new Set<CncCommand>(['estop', 'feedHold', 'resume', 'halt', 'reset']),
  halted: new Set<CncCommand>([
    'cycleStart',
    'halt',
    'feedHold',
    'step',
    'reset',
    'estop',
    'toggleSimulate',
    'jog',
    'stepJog',
    'mdi',
    'zeroAxis',
    'zeroAll',
    'setFixture',
    'setOrigin',
    'invokeAction',
    'loadGcode',
    'saveGcode',
    'saveMachineJson',
    'updateMotionParams',
  ]),
  estop: new Set<CncCommand>([
    'estop',
    'feedHold',
    'reset',
    'invokeAction',
    'loadGcode',
    'saveGcode',
    'saveMachineJson',
  ]),
};

/**
 * Pure safety gate: returns true if `cmd` is permitted in `state`.
 *
 * Safety invariants:
 * - `estop` and `feedHold` are ALWAYS allowed when connected (not `disconnected` or `offline`).
 * - `jog`, `stepJog`, `zeroAxis`, `zeroAll`, `mdi`, `saveMachineJson` are blocked while `running` or `simulating`.
 * - `disconnected` locks all motion commands.
 */
export function canExecute(state: MachineState, cmd: CncCommand): boolean {
  return ALLOWED_COMMANDS[state].has(cmd);
}

/**
 * Returns a human-readable explanation when a command is blocked in the current state, or `null` if allowed.
 */
export function getCommandBlockReason(state: MachineState, cmd: CncCommand): string | null {
  if (canExecute(state, cmd)) return null;
  if (state === 'disconnected') {
    return `Cannot execute "${cmd}" while disconnected from controller.`;
  }
  if (state === 'offline') {
    return `Motion command "${cmd}" is disabled in backend offline preview mode.`;
  }
  if (state === 'running' || state === 'simulating') {
    return `Command "${cmd}" is blocked while program is ${state}. Halt or Feed Hold first.`;
  }
  if (state === 'estop') {
    return `Command "${cmd}" is blocked during E-Stop. Reset or re-enable axes first.`;
  }
  if (state === 'feedhold') {
    return `Command "${cmd}" is blocked during Feed Hold. Resume or Halt first.`;
  }
  return `Command "${cmd}" is not permitted in state "${state}".`;
}

export interface DeriveStateContext {
  connectionState: ConnectionState;
  status: KmxStatus | null;
  previousState: MachineState;
  estopLatched?: boolean;
  haltedLatched?: boolean;
}

/**
 * Derives the canonical `MachineState` from transport connection state + latest `KmxStatus`.
 */
export function deriveMachineState(ctx: DeriveStateContext): MachineState {
  if (ctx.connectionState !== 'connected' || !ctx.status) {
    return 'disconnected';
  }
  if (ctx.status.offline) {
    return 'offline';
  }
  if (ctx.estopLatched) {
    return 'estop';
  }
  if (ctx.status.mainStatus.stopImmediateState !== 0) {
    return 'feedhold';
  }
  if (ctx.status.interpreting) {
    return ctx.status.simulate ? 'simulating' : 'running';
  }
  if (ctx.haltedLatched) {
    return 'halted';
  }
  return 'idle';
}
