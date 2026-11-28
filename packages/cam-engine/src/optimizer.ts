import {
  type ArcSegment,
  type IgmDocument,
  type IgmLayer,
  type IgmSegment,
  type LineSegment,
  type Vec8,
  cloneVec8,
  computeBounds,
  computeSegmentLength,
} from '@kmxcnc/igm';

export interface OptimizeOptions {
  /** Filter out layers with visible === false (default: true). */
  filterVisibleLayers?: boolean;
  /** Optional explicit list of layer IDs to keep. */
  includeLayerIds?: string[];
  /** Scale factor (uniform number or per-axis { x, y, z }). */
  scale?: number | { x?: number; y?: number; z?: number };
  /** Rotation around Z axis in degrees (CCW). */
  rotateDeg?: number;
  /** Translate bounding box min to origin (0,0) or per-axis. */
  translateToOrigin?: boolean | { x?: boolean; y?: boolean; z?: boolean };
  /** Explicit translation offset in mm (applied after translateToOrigin). */
  offset?: { x?: number; y?: number; z?: number };
  /** Remove zero-length / degenerate segments (default: false). */
  removeSingularities?: boolean;
  /** Minimum segment length in mm for singularity removal (default: 1e-4). */
  singularityToleranceMm?: number;
  /** Join collinear adjacent line segments (default: false). */
  joinAdjacent?: boolean;
  /** Tolerance in mm for joining adjacent endpoints & collinearity (default: 1e-3). */
  joinToleranceMm?: number;
  /** Reorder disconnected contours using nearest-neighbor shortest-path heuristic (default: false). */
  shortestPath?: boolean;
  /** Starting XY point for nearest-neighbor reordering (default: { x: 0, y: 0 }). */
  startPoint?: { x: number; y: number };
  /** Endpoint distance tolerance for grouping connected segments into contours (default: 1e-3). */
  contourToleranceMm?: number;
}

function dist2D(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function dist3D(a: Vec8, b: Vec8): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function transformPoint(
  p: Vec8,
  sx: number,
  sy: number,
  sz: number,
  cosR: number,
  sinR: number,
  dx: number,
  dy: number,
  dz: number,
): Vec8 {
  const out = cloneVec8(p);
  const xScaled = p.x * sx;
  const yScaled = p.y * sy;
  const zScaled = p.z * sz;
  out.x = xScaled * cosR - yScaled * sinR + dx;
  out.y = xScaled * sinR + yScaled * cosR + dy;
  out.z = zScaled + dz;
  return out;
}

function transformSegment(
  seg: IgmSegment,
  sx: number,
  sy: number,
  sz: number,
  cosR: number,
  sinR: number,
  dx: number,
  dy: number,
  dz: number,
): IgmSegment {
  const start = transformPoint(seg.start, sx, sy, sz, cosR, sinR, dx, dy, dz);
  const end = transformPoint(seg.end, sx, sy, sz, cosR, sinR, dx, dy, dz);

  if (seg.type === 'line') {
    return { ...seg, start, end };
  }

  const cxScaled = seg.center.x * sx;
  const cyScaled = seg.center.y * sy;
  const czScaled = (seg.center.z ?? 0) * sz;
  const center = {
    x: cxScaled * cosR - cyScaled * sinR + dx,
    y: cxScaled * sinR + cyScaled * cosR + dy,
    ...(seg.center.z !== undefined ? { z: czScaled + dz } : {}),
  };

  // Flip arc direction if mirrored (odd number of negative scales in XY)
  const flipped = sx * sy < 0;
  return {
    ...seg,
    start,
    end,
    center,
    clockwise: flipped ? !seg.clockwise : seg.clockwise,
  };
}

function reverseSegment(seg: IgmSegment): IgmSegment {
  if (seg.type === 'line') {
    return {
      ...seg,
      start: cloneVec8(seg.end),
      end: cloneVec8(seg.start),
    };
  }
  return {
    ...seg,
    start: cloneVec8(seg.end),
    end: cloneVec8(seg.start),
    clockwise: !seg.clockwise,
  };
}

function areCollinearLines(a: LineSegment, b: LineSegment, tol: number): boolean {
  if (a.kind !== b.kind || a.layer !== b.layer) return false;
  if (dist3D(a.end, b.start) > tol) return false;

  const ax = a.end.x - a.start.x;
  const ay = a.end.y - a.start.y;
  const az = a.end.z - a.start.z;
  const bx = b.end.x - b.start.x;
  const by = b.end.y - b.start.y;
  const bz = b.end.z - b.start.z;

  const lenA = Math.hypot(ax, ay, az);
  const lenB = Math.hypot(bx, by, bz);
  if (lenA < 1e-9 || lenB < 1e-9) return true;

  // Dot product of unit direction vectors must be ~ +1 (same direction, not reversing)
  const dot = (ax * bx + ay * by + az * bz) / (lenA * lenB);
  return dot > 1 - 1e-6;
}

function joinAdjacentSegments(segments: IgmSegment[], tol: number): IgmSegment[] {
  if (segments.length <= 1) return segments;
  const result: IgmSegment[] = [];

  for (const seg of segments) {
    const prev = result[result.length - 1];
    if (
      prev &&
      prev.type === 'line' &&
      seg.type === 'line' &&
      areCollinearLines(prev, seg, tol)
    ) {
      result[result.length - 1] = {
        ...prev,
        end: cloneVec8(seg.end),
      };
    } else {
      result.push(seg);
    }
  }
  return result;
}

/**
 * Groups consecutive connected segments into contours/chains, then reorders
 * contours greedily using nearest-neighbor distance (allowing chain reversal
 * when the end of a chain is closer than its start).
 */
function reorderNearestNeighbor(
  segments: IgmSegment[],
  startPoint: { x: number; y: number },
  contourTol: number,
): IgmSegment[] {
  if (segments.length <= 1) return segments;

  // Split into connected chains
  const chains: IgmSegment[][] = [];
  let currentChain: IgmSegment[] = [];

  for (const seg of segments) {
    const prev = currentChain[currentChain.length - 1];
    if (!prev || dist2D(prev.end, seg.start) <= contourTol) {
      currentChain.push(seg);
    } else {
      chains.push(currentChain);
      currentChain = [seg];
    }
  }
  if (currentChain.length > 0) {
    chains.push(currentChain);
  }

  if (chains.length <= 1) return segments;

  const remaining = chains.map((c) => c);
  const ordered: IgmSegment[] = [];
  let cursor = { x: startPoint.x, y: startPoint.y };

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    let bestReverse = false;

    for (let i = 0; i < remaining.length; i++) {
      const chain = remaining[i];
      if (!chain || chain.length === 0) continue;
      const first = chain[0];
      const last = chain[chain.length - 1];
      if (!first || !last) continue;

      const dStart = dist2D(cursor, first.start);
      if (dStart < bestDist) {
        bestDist = dStart;
        bestIdx = i;
        bestReverse = false;
      }

      const dEnd = dist2D(cursor, last.end);
      if (dEnd < bestDist) {
        bestDist = dEnd;
        bestIdx = i;
        bestReverse = true;
      }
    }

    const chosen = remaining.splice(bestIdx, 1)[0];
    if (!chosen || chosen.length === 0) continue;

    if (bestReverse) {
      for (let i = chosen.length - 1; i >= 0; i--) {
        const s = chosen[i];
        if (s) ordered.push(reverseSegment(s));
      }
    } else {
      for (const s of chosen) {
        ordered.push(s);
      }
    }

    const lastOut = ordered[ordered.length - 1];
    if (lastOut) {
      cursor = { x: lastOut.end.x, y: lastOut.end.y };
    }
  }

  return ordered;
}

/**
 * Optimizes and transforms an IGM document according to the provided options.
 * Returns a new IgmDocument without mutating the input.
 */
export function optimizeIgm(doc: IgmDocument, options: OptimizeOptions = {}): IgmDocument {
  const filterVisible = options.filterVisibleLayers ?? true;
  const includeSet = options.includeLayerIds ? new Set(options.includeLayerIds) : null;

  // 1. Filter layers
  let layers: IgmLayer[] = doc.layers
    .filter((l) => {
      if (filterVisible && !l.visible) return false;
      if (includeSet && !includeSet.has(l.id)) return false;
      return true;
    })
    .map((l) => ({
      ...l,
      segments: l.segments.map((s) =>
        s.type === 'line'
          ? { ...s, start: cloneVec8(s.start), end: cloneVec8(s.end) }
          : {
              ...s,
              start: cloneVec8(s.start),
              end: cloneVec8(s.end),
              center: { ...s.center },
            },
      ),
    }));

  // 2. Scale & Rotate
  const sx = typeof options.scale === 'number' ? options.scale : (options.scale?.x ?? 1);
  const sy = typeof options.scale === 'number' ? options.scale : (options.scale?.y ?? 1);
  const sz = typeof options.scale === 'number' ? options.scale : (options.scale?.z ?? 1);
  const rad = ((options.rotateDeg ?? 0) * Math.PI) / 180;
  const cosR = Math.cos(rad);
  const sinR = Math.sin(rad);

  const needsScaleOrRotate = sx !== 1 || sy !== 1 || sz !== 1 || rad !== 0;
  if (needsScaleOrRotate) {
    layers = layers.map((l) => ({
      ...l,
      segments: l.segments.map((s) => transformSegment(s, sx, sy, sz, cosR, sinR, 0, 0, 0)),
    }));
  }

  // 3. Translate to origin + explicit offset
  let dx = options.offset?.x ?? 0;
  let dy = options.offset?.y ?? 0;
  let dz = options.offset?.z ?? 0;

  if (options.translateToOrigin) {
    const preBounds = computeBounds(layers);
    if (!preBounds.empty) {
      const toX =
        options.translateToOrigin === true || Boolean(options.translateToOrigin.x);
      const toY =
        options.translateToOrigin === true || Boolean(options.translateToOrigin.y);
      const toZ =
        typeof options.translateToOrigin === 'object' && Boolean(options.translateToOrigin.z);
      if (toX) dx -= preBounds.min.x;
      if (toY) dy -= preBounds.min.y;
      if (toZ) dz -= preBounds.min.z;
    }
  }

  if (dx !== 0 || dy !== 0 || dz !== 0) {
    layers = layers.map((l) => ({
      ...l,
      segments: l.segments.map((s) => transformSegment(s, 1, 1, 1, 1, 0, dx, dy, dz)),
    }));
  }

  // 4. Remove singularities (zero-length segments)
  if (options.removeSingularities) {
    const tol = options.singularityToleranceMm ?? 1e-4;
    layers = layers.map((l) => ({
      ...l,
      segments: l.segments.filter((s) => computeSegmentLength(s) > tol),
    }));
  }

  // 5. Join adjacent collinear line segments
  if (options.joinAdjacent) {
    const tol = options.joinToleranceMm ?? 1e-3;
    layers = layers.map((l) => ({
      ...l,
      segments: joinAdjacentSegments(l.segments, tol),
    }));
  }

  // 6. Nearest-neighbor shortest-path reordering per layer
  if (options.shortestPath) {
    const startPt = options.startPoint ?? { x: 0, y: 0 };
    const contourTol = options.contourToleranceMm ?? 1e-3;
    layers = layers.map((l) => ({
      ...l,
      segments: reorderNearestNeighbor(l.segments, startPt, contourTol),
    }));
  }

  const bounds = computeBounds(layers);

  return {
    ...doc,
    executable: options.shortestPath || options.joinAdjacent ? false : doc.executable,
    layers,
    bounds,
  };
}
