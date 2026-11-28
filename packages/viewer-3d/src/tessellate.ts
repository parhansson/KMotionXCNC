import type {
  ArcSegment,
  IgmDocument,
  IgmSegment,
  LineSegment,
  MoveKind,
  SourceRef,
  Vec8,
} from '@kmxcnc/igm';
import type {
  RenderLayerBuffer,
  RenderSceneData,
  RotaryAxisAOptions,
  TessellateOptions,
  Vec3,
} from './types';

const DEFAULT_ARC_TOLERANCE_MM = 0.25;
const MAX_ARC_STEPS = 4096;
const DEG_TO_RAD = Math.PI / 180;
const MOVE_KINDS: readonly MoveKind[] = ['rapid', 'cut', 'geometry'];

/**
 * Projects an 8-axis IGM point into 3D space (mm).
 * When `rotaryAxisA.enabled` is true, maps the A axis (degrees) cylindrically
 * around the X axis with base cylinder radius `radiusMm` + Z offset.
 */
export function projectPoint(pt: Vec8, rotary?: RotaryAxisAOptions): Vec3 {
  if (!rotary?.enabled) {
    return { x: pt.x, y: pt.y, z: pt.z };
  }
  const theta = (pt.a ?? 0) * DEG_TO_RAD;
  const r = rotary.radiusMm + pt.z;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  return {
    x: pt.x,
    y: pt.y * cos - r * sin,
    z: pt.y * sin + r * cos,
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpOpt(a: number | undefined, b: number | undefined, t: number): number | undefined {
  if (a === undefined && b === undefined) return undefined;
  return lerp(a ?? 0, b ?? 0, t);
}

function computeChordSteps(radius: number, sweepRad: number, toleranceMm: number): number {
  const absSweep = Math.abs(sweepRad);
  if (absSweep < 1e-9) return 1;
  const tol = Math.max(toleranceMm, 1e-3);
  let maxStepAngle = Math.PI / 4;
  if (radius > tol) {
    const ratio = Math.max(-1, Math.min(1, 1 - tol / radius));
    const computed = 2 * Math.acos(ratio);
    if (Number.isFinite(computed) && computed > 1e-6) {
      maxStepAngle = Math.min(maxStepAngle, computed);
    }
  }
  const steps = Math.ceil(absSweep / maxStepAngle);
  return Math.max(2, Math.min(MAX_ARC_STEPS, steps));
}

/**
 * Tessellates a line segment into a polyline of Vec8 points.
 * Subdivides rotary A moves when cylindrical projection is enabled so the
 * projected path curves smoothly around the cylinder.
 */
function tessellateLine(
  seg: LineSegment,
  toleranceMm: number,
  rotary?: RotaryAxisAOptions,
): Vec8[] {
  if (!rotary?.enabled) {
    return [seg.start, seg.end];
  }

  const a0 = seg.start.a ?? 0;
  const a1 = seg.end.a ?? 0;
  const deltaRad = (a1 - a0) * DEG_TO_RAD;
  if (Math.abs(deltaRad) < 1e-6) {
    return [seg.start, seg.end];
  }

  const effectiveRadius = Math.max(
    Math.abs(rotary.radiusMm + seg.start.z),
    Math.abs(rotary.radiusMm + seg.end.z),
    Math.abs(rotary.radiusMm),
  );
  const steps = computeChordSteps(effectiveRadius, deltaRad, toleranceMm);
  const points: Vec8[] = [seg.start];
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    points.push({
      x: lerp(seg.start.x, seg.end.x, t),
      y: lerp(seg.start.y, seg.end.y, t),
      z: lerp(seg.start.z, seg.end.z, t),
      a: lerp(a0, a1, t),
      b: lerpOpt(seg.start.b, seg.end.b, t),
      c: lerpOpt(seg.start.c, seg.end.c, t),
      u: lerpOpt(seg.start.u, seg.end.u, t),
      v: lerpOpt(seg.start.v, seg.end.v, t),
    });
  }
  points.push(seg.end);
  return points;
}

/**
 * Tessellates a G17 (XY), G18 (ZX), or G19 (YZ) helical arc into a polyline of Vec8 points.
 */
function tessellateArc(arc: ArcSegment, toleranceMm: number): Vec8[] {
  const { start, end, center, clockwise, plane } = arc;

  // Map plane axes (primary, secondary, helical) in right-handed order:
  // G17: X, Y (normal +Z)
  // G18: Z, X (normal +Y)
  // G19: Y, Z (normal +X)
  let s1: number;
  let s2: number;
  let e1: number;
  let e2: number;
  let c1: number;
  let c2: number;

  switch (plane) {
    case 'G17':
      s1 = start.x;
      s2 = start.y;
      e1 = end.x;
      e2 = end.y;
      c1 = center.x;
      c2 = center.y;
      break;
    case 'G18':
      s1 = start.z;
      s2 = start.x;
      e1 = end.z;
      e2 = end.x;
      c1 = center.z ?? start.z;
      c2 = center.x;
      break;
    case 'G19':
      s1 = start.y;
      s2 = start.z;
      e1 = end.y;
      e2 = end.z;
      c1 = center.y;
      c2 = center.z ?? start.z;
      break;
  }

  const r0 = Math.hypot(s1 - c1, s2 - c2);
  const r1 = Math.hypot(e1 - c1, e2 - c2);

  if (r0 < 1e-9 && r1 < 1e-9) {
    return [start, end];
  }

  const a0 = Math.atan2(s2 - c2, s1 - c1);
  const a1 = Math.atan2(e2 - c2, e1 - c1);

  let delta = a1 - a0;
  if (clockwise) {
    if (delta >= -1e-9) {
      delta -= 2 * Math.PI;
    }
  } else {
    if (delta <= 1e-9) {
      delta += 2 * Math.PI;
    }
  }

  const maxRadius = Math.max(r0, r1);
  const steps = computeChordSteps(maxRadius, delta, toleranceMm);

  const points: Vec8[] = [start];
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const angle = a0 + delta * t;
    const r = lerp(r0, r1, t);
    const p1 = c1 + r * Math.cos(angle);
    const p2 = c2 + r * Math.sin(angle);

    let x: number;
    let y: number;
    let z: number;

    switch (plane) {
      case 'G17':
        x = p1;
        y = p2;
        z = lerp(start.z, end.z, t);
        break;
      case 'G18':
        z = p1;
        x = p2;
        y = lerp(start.y, end.y, t);
        break;
      case 'G19':
        y = p1;
        z = p2;
        x = lerp(start.x, end.x, t);
        break;
    }

    points.push({
      x,
      y,
      z,
      a: lerpOpt(start.a, end.a, t),
      b: lerpOpt(start.b, end.b, t),
      c: lerpOpt(start.c, end.c, t),
      u: lerpOpt(start.u, end.u, t),
      v: lerpOpt(start.v, end.v, t),
    });
  }
  points.push(end);
  return points;
}

function tessellateSegment(
  seg: IgmSegment,
  toleranceMm: number,
  rotary?: RotaryAxisAOptions,
): Vec8[] {
  if (seg.type === 'line') {
    return tessellateLine(seg, toleranceMm, rotary);
  }
  return tessellateArc(seg, toleranceMm);
}

interface LayerBucket {
  coords: number[];
  sourceRefs: (SourceRef | null)[];
}

/**
 * Pure, renderer-independent tessellation of an IGM document into packed
 * Float32Array line-segment buffers grouped by layer and MoveKind.
 */
export function tessellateIgm(
  doc: IgmDocument,
  options?: TessellateOptions,
): RenderSceneData {
  const toleranceMm = options?.arcToleranceMm ?? DEFAULT_ARC_TOLERANCE_MM;
  const rotary = options?.rotaryAxisA;

  const layers: RenderLayerBuffer[] = [];
  let totalSegments = 0;

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  const expandBounds = (p: Vec3): void => {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.z < minZ) minZ = p.z;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
    if (p.z > maxZ) maxZ = p.z;
  };

  for (const layer of doc.layers) {
    if (!layer.visible) continue;

    const buckets: Record<MoveKind, LayerBucket> = {
      rapid: { coords: [], sourceRefs: [] },
      cut: { coords: [], sourceRefs: [] },
      geometry: { coords: [], sourceRefs: [] },
    };

    for (const seg of layer.segments) {
      const polyline = tessellateSegment(seg, toleranceMm, rotary);
      if (polyline.length < 2) continue;

      const bucket = buckets[seg.kind];
      const ref: SourceRef | null = seg.sourceRef ?? null;

      let prev = projectPoint(polyline[0]!, rotary);
      expandBounds(prev);

      for (let i = 1; i < polyline.length; i++) {
        const curr = projectPoint(polyline[i]!, rotary);
        expandBounds(curr);
        bucket.coords.push(prev.x, prev.y, prev.z, curr.x, curr.y, curr.z);
        bucket.sourceRefs.push(ref);
        prev = curr;
      }
    }

    for (const kind of MOVE_KINDS) {
      const bucket = buckets[kind];
      const segmentCount = bucket.sourceRefs.length;
      if (segmentCount === 0) continue;

      layers.push({
        layerId: layer.id,
        kind,
        positions: new Float32Array(bucket.coords),
        segmentCount,
        sourceRefs: bucket.sourceRefs,
      });
      totalSegments += segmentCount;
    }
  }

  const bounds =
    totalSegments > 0
      ? {
          min: { x: minX, y: minY, z: minZ },
          max: { x: maxX, y: maxY, z: maxZ },
        }
      : {
          min: { x: 0, y: 0, z: 0 },
          max: { x: 0, y: 0, z: 0 },
        };

  return {
    layers,
    bounds,
    totalSegments,
  };
}
