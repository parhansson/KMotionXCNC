export type AxisName = 'x' | 'y' | 'z' | 'a' | 'b' | 'c' | 'u' | 'v';

export const AXES: readonly AxisName[] = ['x', 'y', 'z', 'a', 'b', 'c', 'u', 'v'] as const;
export const LINEAR_AXES = ['x', 'y', 'z', 'u', 'v'] as const;
export const ROTARY_AXES = ['a', 'b', 'c'] as const;

/**
 * 8-axis canonical position vector.
 * Linear axes (x, y, z, u, v) are in millimeters (mm).
 * Rotary axes (a, b, c) are in degrees (deg).
 */
export interface Vec8 {
  x: number;
  y: number;
  z: number;
  a?: number;
  b?: number;
  c?: number;
  u?: number;
  v?: number;
}

export type SourceRef =
  | { kind: 'gcode'; line: number; callStack?: number[] }
  | { kind: 'heidenhain'; line: number; callStack?: number[] }
  | { kind: 'svg'; elementId: string }
  | { kind: 'dxf'; handle: string }
  | { kind: 'pdf'; page: number; opIndex: number };

export interface StockBounds {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
}

export type MoveKind = 'geometry' | 'rapid' | 'cut';

export type ArcPlane = 'G17' | 'G18' | 'G19';

export interface LineSegment {
  type: 'line';
  kind: MoveKind;
  start: Vec8;
  end: Vec8;
  /** Feed rate in mm/min (canonical). */
  feedRate?: number;
  layer: string;
  sourceRef?: SourceRef;
}

export interface ArcSegment {
  type: 'arc';
  kind: MoveKind;
  start: Vec8;
  end: Vec8;
  /** Absolute arc center in mm. */
  center: { x: number; y: number; z?: number };
  clockwise: boolean;
  plane: ArcPlane;
  /** Feed rate in mm/min (canonical). */
  feedRate?: number;
  layer: string;
  sourceRef?: SourceRef;
}

export type IgmSegment = LineSegment | ArcSegment;

export interface IgmLayer {
  id: string;
  name: string;
  visible: boolean;
  color?: string;
  segments: IgmSegment[];
}

export interface Bounds8 {
  min: Vec8;
  max: Vec8;
  empty: boolean;
}

export interface IgmDocument {
  version: 1;
  units: 'mm';
  executable: boolean;
  layers: IgmLayer[];
  bounds: Bounds8;
  metadata?: Record<string, unknown>;
}

export function createEmptyBounds8(): Bounds8 {
  return {
    min: { x: 0, y: 0, z: 0 },
    max: { x: 0, y: 0, z: 0 },
    empty: true,
  };
}

export function createEmptyDocument(executable = false, metadata?: Record<string, unknown>): IgmDocument {
  return {
    version: 1,
    units: 'mm',
    executable,
    layers: [],
    bounds: createEmptyBounds8(),
    ...(metadata ? { metadata } : {}),
  };
}

export function cloneVec8(v: Vec8): Vec8 {
  const out: Vec8 = { x: v.x, y: v.y, z: v.z };
  if (v.a !== undefined) out.a = v.a;
  if (v.b !== undefined) out.b = v.b;
  if (v.c !== undefined) out.c = v.c;
  if (v.u !== undefined) out.u = v.u;
  if (v.v !== undefined) out.v = v.v;
  return out;
}
