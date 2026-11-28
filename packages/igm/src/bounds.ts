import {
  type ArcPlane,
  type ArcSegment,
  type AxisName,
  type Bounds8,
  type IgmDocument,
  type IgmLayer,
  type IgmSegment,
  type Vec8,
  createEmptyBounds8,
} from './types';

export interface PlaneAxes {
  u: 'x' | 'y' | 'z';
  v: 'x' | 'y' | 'z';
  w: 'x' | 'y' | 'z';
}

/**
 * Returns right-handed (u, v, w) axis mapping for an arc plane:
 * - G17 (XY): u=x, v=y, w=z
 * - G18 (ZX): u=z, v=x, w=y
 * - G19 (YZ): u=y, v=z, w=x
 */
export function getArcPlaneAxes(plane: ArcPlane): PlaneAxes {
  switch (plane) {
    case 'G17':
      return { u: 'x', v: 'y', w: 'z' };
    case 'G18':
      return { u: 'z', v: 'x', w: 'y' };
    case 'G19':
      return { u: 'y', v: 'z', w: 'x' };
  }
}

export interface ArcGeometryInfo {
  cu: number;
  cv: number;
  radius: number;
  startAngle: number;
  endAngle: number;
  /** Signed angular sweep in radians (negative for clockwise, positive for CCW). */
  sweep: number;
  axes: PlaneAxes;
}

const TWO_PI = Math.PI * 2;
const FULL_CIRCLE_EPS = 1e-9;

function getCenterAxis(center: ArcSegment['center'], axis: 'x' | 'y' | 'z'): number {
  if (axis === 'z') return center.z ?? 0;
  return center[axis];
}

export function getArcGeometry(seg: ArcSegment): ArcGeometryInfo {
  const axes = getArcPlaneAxes(seg.plane);
  const cu = getCenterAxis(seg.center, axes.u);
  const cv = getCenterAxis(seg.center, axes.v);

  const su = seg.start[axes.u];
  const sv = seg.start[axes.v];
  const eu = seg.end[axes.u];
  const ev = seg.end[axes.v];

  const radius = Math.hypot(su - cu, sv - cv);
  const startAngle = Math.atan2(sv - cv, su - cu);
  const endAngle = Math.atan2(ev - cv, eu - cu);

  const isFullCircle = Math.hypot(eu - su, ev - sv) <= FULL_CIRCLE_EPS && radius > FULL_CIRCLE_EPS;

  let sweep: number;
  if (isFullCircle) {
    sweep = seg.clockwise ? -TWO_PI : TWO_PI;
  } else if (seg.clockwise) {
    sweep = endAngle - startAngle;
    while (sweep >= 0) sweep -= TWO_PI;
  } else {
    sweep = endAngle - startAngle;
    while (sweep <= 0) sweep += TWO_PI;
  }

  return { cu, cv, radius, startAngle, endAngle, sweep, axes };
}

function normalizeAngle(angle: number): number {
  let a = angle % TWO_PI;
  if (a < 0) a += TWO_PI;
  return a;
}

function isAngleOnArc(angle: number, startAngle: number, sweep: number): boolean {
  if (Math.abs(sweep) >= TWO_PI - FULL_CIRCLE_EPS) {
    return true;
  }
  if (sweep > 0) {
    const delta = normalizeAngle(angle - startAngle);
    return delta <= sweep + 1e-12;
  } else {
    const delta = normalizeAngle(startAngle - angle);
    return delta <= -sweep + 1e-12;
  }
}

class BoundsAccumulator {
  empty = true;
  minX = Infinity;
  minY = Infinity;
  minZ = Infinity;
  maxX = -Infinity;
  maxY = -Infinity;
  maxZ = -Infinity;

  minOpt: Partial<Record<'a' | 'b' | 'c' | 'u' | 'v', number>> = {};
  maxOpt: Partial<Record<'a' | 'b' | 'c' | 'u' | 'v', number>> = {};

  includePoint(p: Vec8): void {
    this.empty = false;
    if (p.x < this.minX) this.minX = p.x;
    if (p.y < this.minY) this.minY = p.y;
    if (p.z < this.minZ) this.minZ = p.z;
    if (p.x > this.maxX) this.maxX = p.x;
    if (p.y > this.maxY) this.maxY = p.y;
    if (p.z > this.maxZ) this.maxZ = p.z;

    this.includeOptionalAxis('a', p.a);
    this.includeOptionalAxis('b', p.b);
    this.includeOptionalAxis('c', p.c);
    this.includeOptionalAxis('u', p.u);
    this.includeOptionalAxis('v', p.v);
  }

  includeAxisValue(axis: 'x' | 'y' | 'z', val: number): void {
    this.empty = false;
    if (axis === 'x') {
      if (val < this.minX) this.minX = val;
      if (val > this.maxX) this.maxX = val;
    } else if (axis === 'y') {
      if (val < this.minY) this.minY = val;
      if (val > this.maxY) this.maxY = val;
    } else {
      if (val < this.minZ) this.minZ = val;
      if (val > this.maxZ) this.maxZ = val;
    }
  }

  private includeOptionalAxis(axis: 'a' | 'b' | 'c' | 'u' | 'v', val: number | undefined): void {
    if (val === undefined || !Number.isFinite(val)) return;
    const curMin = this.minOpt[axis];
    const curMax = this.maxOpt[axis];
    if (curMin === undefined || val < curMin) this.minOpt[axis] = val;
    if (curMax === undefined || val > curMax) this.maxOpt[axis] = val;
  }

  includeSegment(seg: IgmSegment): void {
    this.includePoint(seg.start);
    this.includePoint(seg.end);

    if (seg.type === 'arc') {
      const { cu, cv, radius, startAngle, sweep, axes } = getArcGeometry(seg);
      if (radius > FULL_CIRCLE_EPS) {
        const cardinals = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
        for (const angle of cardinals) {
          if (isAngleOnArc(angle, startAngle, sweep)) {
            this.includeAxisValue(axes.u, cu + radius * Math.cos(angle));
            this.includeAxisValue(axes.v, cv + radius * Math.sin(angle));
          }
        }
      }
    }
  }

  toBounds8(): Bounds8 {
    if (this.empty) {
      return createEmptyBounds8();
    }
    const min: Vec8 = { x: this.minX, y: this.minY, z: this.minZ };
    const max: Vec8 = { x: this.maxX, y: this.maxY, z: this.maxZ };
    const optAxes: readonly ('a' | 'b' | 'c' | 'u' | 'v')[] = ['a', 'b', 'c', 'u', 'v'];
    for (const axis of optAxes) {
      if (this.minOpt[axis] !== undefined && this.maxOpt[axis] !== undefined) {
        min[axis] = this.minOpt[axis];
        max[axis] = this.maxOpt[axis];
      }
    }
    return { min, max, empty: false };
  }
}

export function computeSegmentBounds(seg: IgmSegment): Bounds8 {
  const acc = new BoundsAccumulator();
  acc.includeSegment(seg);
  return acc.toBounds8();
}

export function mergeBounds(a: Bounds8, b: Bounds8): Bounds8 {
  if (a.empty) return b;
  if (b.empty) return a;
  const acc = new BoundsAccumulator();
  acc.includePoint(a.min);
  acc.includePoint(a.max);
  acc.includePoint(b.min);
  acc.includePoint(b.max);
  return acc.toBounds8();
}

function isIgmDocument(
  input: IgmDocument | readonly IgmLayer[] | readonly IgmSegment[],
): input is IgmDocument {
  return !Array.isArray(input) && typeof input === 'object' && input !== null && 'layers' in input;
}

function isLayerArray(
  input: readonly IgmLayer[] | readonly IgmSegment[],
): input is readonly IgmLayer[] {
  const first = input[0];
  return first !== undefined && 'segments' in first;
}

export interface ComputeBoundsOptions {
  visibleOnly?: boolean;
}

/**
 * Computes accurate 8-axis Bounds8 (including cardinal arc extrema) for an
 * IgmDocument, list of IgmLayers, or list of IgmSegments.
 */
export function computeBounds(
  input: IgmDocument | readonly IgmLayer[] | readonly IgmSegment[],
  options?: ComputeBoundsOptions,
): Bounds8 {
  const acc = new BoundsAccumulator();
  const visibleOnly = options?.visibleOnly ?? false;

  if (isIgmDocument(input)) {
    for (const layer of input.layers) {
      if (visibleOnly && !layer.visible) continue;
      for (const seg of layer.segments) {
        acc.includeSegment(seg);
      }
    }
  } else if (isLayerArray(input)) {
    for (const layer of input) {
      if (visibleOnly && !layer.visible) continue;
      for (const seg of layer.segments) {
        acc.includeSegment(seg);
      }
    }
  } else {
    for (const seg of input) {
      acc.includeSegment(seg);
    }
  }

  return acc.toBounds8();
}

/**
 * Computes the geometric path length in mm for a line or arc (including helical arcs).
 */
export function computeSegmentLength(seg: IgmSegment): number {
  if (seg.type === 'line') {
    const dx = seg.end.x - seg.start.x;
    const dy = seg.end.y - seg.start.y;
    const dz = seg.end.z - seg.start.z;
    const du = (seg.end.u ?? 0) - (seg.start.u ?? 0);
    const dv = (seg.end.v ?? 0) - (seg.start.v ?? 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz + du * du + dv * dv);
  }

  const { radius, sweep, axes } = getArcGeometry(seg);
  const arcLen = radius * Math.abs(sweep);
  const dw = seg.end[axes.w] - seg.start[axes.w];
  return Math.hypot(arcLen, dw);
}

/**
 * Helper to read any axis value from a Vec8.
 */
export function getAxisValue(v: Vec8, axis: AxisName): number | undefined {
  return v[axis];
}
