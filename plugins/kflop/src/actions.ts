import type { FormFieldSchema } from '@kmxcnc/plugin-sdk';
import type { MainStatusLike } from './pinouts.js';

export type KflopActionCode = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface KflopActionTypeDef {
  action: KflopActionCode;
  name: string;
  description: string;
  visible: readonly [boolean, boolean, boolean, boolean, boolean, boolean];
  paramNames: readonly [string, string, string, string, string, string];
}

export const KFLOP_ACTION_TYPES: readonly KflopActionTypeDef[] = [
  {
    action: 0,
    name: 'None',
    description: 'No action assigned',
    visible: [false, false, false, false, false, false],
    paramNames: ['', '', '', '', '', ''],
  },
  {
    action: 1,
    name: 'Set a bit high or low',
    description: 'Sets a single KFLOP digital I/O bit to 0 or 1',
    visible: [true, true, false, false, false, false],
    paramNames: ['Set bit', 'to', '', '', '', ''],
  },
  {
    action: 2,
    name: 'Set two bits either high or low',
    description: 'Sets two KFLOP digital I/O bits to 0 or 1',
    visible: [true, true, true, true, false, false],
    paramNames: ['Set bit', 'to', 'and bit', 'to', '', ''],
  },
  {
    action: 3,
    name: 'Output a value to a DAC',
    description: 'Outputs a scaled and clamped value to a KFLOP/Kanalog DAC channel',
    visible: [true, true, true, true, true, false],
    paramNames: ['Set DAC', 'scale', 'offset', 'min', 'max', ''],
  },
  {
    action: 4,
    name: 'Run a KMotion User C program',
    description: 'Compiles and executes a KFLOP C program on the specified thread without waiting',
    visible: [true, true, false, false, false, true],
    paramNames: ['Thread', 'VAR', '', '', '', 'File'],
  },
  {
    action: 5,
    name: 'Run a KMotion User C program, wait til finished',
    description: 'Executes a KFLOP C program and blocks interpreter until the thread finishes',
    visible: [true, true, false, false, false, true],
    paramNames: ['Thread', 'VAR', '', '', '', 'File'],
  },
  {
    action: 6,
    name: 'Run a KMotion User C program, wait til finished, resync positions',
    description: 'Executes a KFLOP C program, waits until finished, and resynchronizes interpreter positions',
    visible: [true, true, false, false, false, true],
    paramNames: ['Thread', 'VAR', '', '', '', 'File'],
  },
  {
    action: 7,
    name: 'Run an external program, wait til finished',
    description: 'Runs an external host program and waits until it exits',
    visible: [false, false, false, false, false, true],
    paramNames: ['', '', '', '', '', 'File'],
  },
  {
    action: 8,
    name: 'Callback to the User Application',
    description: 'Invokes a non-blocking callback in the host UI application',
    visible: [false, false, false, false, false, false],
    paramNames: ['', '', '', '', '', ''],
  },
  {
    action: 9,
    name: 'Wait/Hold until a bit is high or low',
    description: 'Pauses interpreter execution until the specified KFLOP I/O bit reaches the target state',
    visible: [true, true, false, false, false, false],
    paramNames: ['Wait bit', 'till', '', '', '', ''],
  },
];

export const STANDARD_MCODES = [
  'M0',
  'M1',
  'M2',
  'M3',
  'M4',
  'M5',
  'M6',
  'M7',
  'M8',
  'M9',
  'S',
] as const;

export const SPECIAL_ACTIONS = [
  'M30',
  'Cycle Start',
  'Halt',
  'Stop',
  'Feedhold',
  'Resume',
  'Prog Start',
  'Prog Exit',
] as const;

export const EXTENDED_MCODES = [
  'M100',
  'M101',
  'M102',
  'M103',
  'M104',
  'M105',
  'M106',
  'M107',
  'M108',
  'M109',
  'M110',
  'M111',
  'M112',
  'M113',
  'M114',
  'M115',
  'M116',
  'M117',
  'M118',
  'M119',
] as const;

export const USER_BUTTON_COUNT = 10;

export const KFLOP_AXES_8 = ['X', 'Y', 'Z', 'A', 'B', 'C', 'U', 'V'] as const;
export type KflopAxisName = (typeof KFLOP_AXES_8)[number];

export interface KflopActionConfig {
  action: KflopActionCode;
  name?: string;
  dParam0?: number;
  dParam1?: number;
  dParam2?: number;
  dParam3?: number;
  dParam4?: number;
  file?: string;
}

export const MOTION_PARAMS_AXIS_FIELDS: readonly FormFieldSchema[] = [
  {
    name: 'countsPerUnit',
    label: 'Counts per Unit',
    type: 'number',
    defaultValue: 2540,
    unit: 'cnt/in',
    min: 0,
    order: 1,
  },
  {
    name: 'maxVel',
    label: 'Max Velocity',
    type: 'number',
    defaultValue: 10,
    unit: 'in/s',
    min: 0,
    order: 2,
  },
  {
    name: 'maxAccel',
    label: 'Max Acceleration',
    type: 'number',
    defaultValue: 20,
    unit: 'in/s²',
    min: 0,
    order: 3,
  },
  {
    name: 'jogVel',
    label: 'Jog Velocity',
    type: 'number',
    defaultValue: 5,
    unit: 'in/s',
    min: 0,
    order: 4,
  },
  {
    name: 'softLimitNeg',
    label: 'Soft Limit (-)',
    type: 'number',
    defaultValue: -1e9,
    unit: 'in',
    order: 5,
  },
  {
    name: 'softLimitPos',
    label: 'Soft Limit (+)',
    type: 'number',
    defaultValue: 1e9,
    unit: 'in',
    order: 6,
  },
  {
    name: 'maxJerk',
    label: 'Max Jerk (3rd-order TP)',
    type: 'number',
    defaultValue: 0,
    unit: 'in/s³',
    min: 0,
    order: 7,
  },
  {
    name: 'degrees',
    label: 'Rotary Axis (Degrees)',
    type: 'boolean',
    defaultValue: false,
    order: 8,
  },
  {
    name: 'radius',
    label: 'Rotary Radius',
    type: 'number',
    defaultValue: 0,
    unit: 'in',
    min: 0,
    order: 9,
  },
];

export const TPLANNER_FIELDS: readonly FormFieldSchema[] = [
  {
    name: 'breakangle',
    label: 'Break Angle',
    type: 'number',
    defaultValue: 30,
    unit: 'deg',
    min: 0,
    max: 180,
    order: 1,
  },
  {
    name: 'cornertolerance',
    label: 'Corner Tolerance',
    type: 'number',
    defaultValue: 0.003,
    unit: 'in',
    min: 0,
    step: 0.001,
    order: 2,
  },
  {
    name: 'lookahead',
    label: 'Lookahead',
    type: 'number',
    defaultValue: 3,
    unit: 's',
    min: 0,
    step: 0.1,
    order: 3,
  },
  {
    name: 'collineartolerance',
    label: 'Collinear Tolerance',
    type: 'number',
    defaultValue: 0.0005,
    unit: 'in',
    min: 0,
    step: 0.0001,
    order: 4,
  },
  {
    name: 'facetangle',
    label: 'Facet Angle',
    type: 'number',
    defaultValue: 0.5,
    unit: 'deg',
    min: 0,
    step: 0.1,
    order: 5,
  },
  {
    name: 'thirdOrderTP',
    label: '3rd-Order Trajectory Planner',
    type: 'boolean',
    defaultValue: false,
    order: 6,
  },
  {
    name: 'arcsToSegs',
    label: 'Convert Arcs to Segments',
    type: 'boolean',
    defaultValue: false,
    order: 7,
  },
  {
    name: 'doRapidsAsFeeds',
    label: 'Execute Rapids as Feeds',
    type: 'boolean',
    defaultValue: false,
    order: 8,
  },
];

export interface ThreadStatus {
  /** KFLOP user thread number (1–7). */
  thread: number;
  active: boolean;
  runOnStartUp: boolean;
}

function decodeThreadFlag(
  source: readonly boolean[] | number | undefined,
  thread: number,
): boolean {
  if (source === undefined) {
    return false;
  }
  if (typeof source === 'number') {
    // KFLOP ThreadActive bitmask: bit 1 = Thread 1, ..., bit 7 = Thread 7
    return ((source >>> thread) & 1) === 1;
  }
  // Support 8-element array indexed directly by thread (1..7) OR 7-element 0-indexed array
  if (source.length >= 8) {
    return Boolean(source[thread]);
  }
  return Boolean(source[thread - 1]);
}

/**
 * Decodes KFLOP user thread 1–7 active & run-on-startup states from MAIN_STATUS.
 */
export function decodeThreads(
  mainStatus: MainStatusLike | null | undefined,
): ThreadStatus[] {
  const activeSource = mainStatus?.threadActive ?? mainStatus?.ThreadActive;
  const startupSource = mainStatus?.runOnStartUp ?? mainStatus?.RunOnStartUp;

  const threads: ThreadStatus[] = [];
  for (let thread = 1; thread <= 7; thread++) {
    threads.push({
      thread,
      active: decodeThreadFlag(activeSource, thread),
      runOnStartUp: decodeThreadFlag(startupSource, thread),
    });
  }
  return threads;
}

export function getActionTypeDef(action: number): KflopActionTypeDef {
  return KFLOP_ACTION_TYPES[action] ?? KFLOP_ACTION_TYPES[0]!;
}
