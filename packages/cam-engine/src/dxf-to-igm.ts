import DxfParser, {
  type IArcEntity,
  type ICircleEntity,
  type IDxf,
  type IEllipseEntity,
  type IEntity,
  type ILineEntity,
  type ILwpolylineEntity,
  type IPoint,
  type IPolylineEntity,
  type ISplineEntity,
} from 'dxf-parser';
import {
  type ArcSegment,
  type IgmDocument,
  type IgmLayer,
  type LineSegment,
  computeBounds,
} from '@kmxcnc/igm';

export interface DxfParseOptions {
  /** Override input units instead of reading $INSUNITS header. */
  units?: 'mm' | 'in' | 'cm' | 'm';
  /** Extra uniform scale factor (default: 1). */
  scale?: number;
  /** Number of segments used when approximating SPLINE and ELLIPSE entities (default: 32). */
  splineSubdivisions?: number;
}

function getDxfUnitScale(dxf: IDxf, overrideUnits?: DxfParseOptions['units']): number {
  if (overrideUnits) {
    switch (overrideUnits) {
      case 'in':
        return 25.4;
      case 'cm':
        return 10;
      case 'm':
        return 1000;
      case 'mm':
        return 1;
    }
  }
  const insUnits = dxf.header?.$INSUNITS;
  if (typeof insUnits === 'number') {
    switch (insUnits) {
      case 1: // Inches
        return 25.4;
      case 2: // Feet
        return 304.8;
      case 4: // Millimeters
        return 1;
      case 5: // Centimeters
        return 10;
      case 6: // Meters
        return 1000;
      default:
        return 1;
    }
  }
  return 1;
}

function dxfColorToHex(colorInt: number | undefined): string | undefined {
  if (colorInt === undefined || !Number.isFinite(colorInt)) return undefined;
  const hex = (colorInt & 0xffffff).toString(16).padStart(6, '0');
  return `#${hex}`;
}

/**
 * Converts a DXF bulge segment between p1 and p2 into an ArcSegment.
 * Bulge = tan(includedAngle / 4). Positive bulge = CCW, negative bulge = CW.
 */
function bulgeToArcSegment(
  p1: { x: number; y: number; z: number },
  p2: { x: number; y: number; z: number },
  bulge: number,
  layer: string,
  handle: string,
): ArcSegment | LineSegment {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const chord = Math.hypot(dx, dy);
  if (chord < 1e-9 || Math.abs(bulge) < 1e-9) {
    return {
      type: 'line',
      kind: 'geometry',
      start: p1,
      end: p2,
      layer,
      sourceRef: { kind: 'dxf', handle },
    };
  }

  const theta = 4 * Math.atan(Math.abs(bulge));
  const radius = chord / (2 * Math.sin(theta / 2));
  const sagittaOffset = radius * Math.cos(theta / 2);

  const mx = (p1.x + p2.x) / 2;
  const my = (p1.y + p2.y) / 2;
  // Unit normal to the left of p1->p2
  const nx = -dy / chord;
  const ny = dx / chord;

  // Positive bulge = CCW (center on left for <180 deg, right for >180 deg)
  const sign = bulge > 0 ? 1 : -1;
  const cx = mx + sign * sagittaOffset * nx;
  const cy = my + sign * sagittaOffset * ny;

  return {
    type: 'arc',
    kind: 'geometry',
    start: p1,
    end: p2,
    center: { x: cx, y: cy, z: p1.z },
    clockwise: bulge < 0,
    plane: 'G17',
    layer,
    sourceRef: { kind: 'dxf', handle },
  };
}

/**
 * Evaluates a B-spline curve at parameter t using Cox-de Boor recursion.
 */
function evalBSpline(
  degree: number,
  knots: number[],
  points: IPoint[],
  t: number,
): { x: number; y: number; z: number } {
  const n = points.length - 1;
  if (n < 0) return { x: 0, y: 0, z: 0 };

  // Find knot span
  let k = degree;
  for (let i = degree; i <= n; i++) {
    const ki = knots[i] ?? 0;
    const ki1 = knots[i + 1] ?? 0;
    if (t >= ki && t < ki1) {
      k = i;
      break;
    }
    if (i === n) k = n;
  }

  const d: Array<{ x: number; y: number; z: number }> = [];
  for (let j = 0; j <= degree; j++) {
    const pt = points[Math.max(0, Math.min(n, k - degree + j))];
    d.push({ x: pt?.x ?? 0, y: pt?.y ?? 0, z: pt?.z ?? 0 });
  }

  for (let r = 1; r <= degree; r++) {
    for (let j = degree; j >= r; j--) {
      const idx = k - degree + j;
      const denom = (knots[idx + degree + 1 - r] ?? 0) - (knots[idx] ?? 0);
      const alpha = Math.abs(denom) > 1e-12 ? (t - (knots[idx] ?? 0)) / denom : 0;
      const prev = d[j - 1] ?? { x: 0, y: 0, z: 0 };
      const curr = d[j] ?? { x: 0, y: 0, z: 0 };
      d[j] = {
        x: (1 - alpha) * prev.x + alpha * curr.x,
        y: (1 - alpha) * prev.y + alpha * curr.y,
        z: (1 - alpha) * prev.z + alpha * curr.z,
      };
    }
  }

  return d[degree] ?? { x: 0, y: 0, z: 0 };
}

function sampleSpline(spline: ISplineEntity, subdivisions: number): Array<{ x: number; y: number; z: number }> {
  const ctrl = spline.controlPoints;
  if (!ctrl || ctrl.length < 2) {
    const fit = spline.fitPoints ?? [];
    return fit.map((p) => ({ x: p.x, y: p.y, z: p.z ?? 0 }));
  }

  const degree = Math.min(spline.degreeOfSplineCurve || 3, ctrl.length - 1);
  let knots = spline.knotValues ?? [];
  const expectedKnots = ctrl.length + degree + 1;

  if (knots.length < expectedKnots) {
    // Generate clamped uniform knot vector
    knots = [];
    for (let i = 0; i < expectedKnots; i++) {
      if (i <= degree) knots.push(0);
      else if (i >= expectedKnots - degree - 1) knots.push(1);
      else knots.push((i - degree) / (ctrl.length - degree));
    }
  }

  const tMin = knots[degree] ?? 0;
  const tMax = knots[ctrl.length] ?? 1;
  if (Math.abs(tMax - tMin) < 1e-12) {
    return ctrl.map((p) => ({ x: p.x, y: p.y, z: p.z ?? 0 }));
  }

  const pts: Array<{ x: number; y: number; z: number }> = [];
  for (let i = 0; i <= subdivisions; i++) {
    const t = i === subdivisions ? tMax : tMin + ((tMax - tMin) * i) / subdivisions;
    pts.push(evalBSpline(degree, knots, ctrl, t));
  }
  return pts;
}

/**
 * Parses a DXF string into an IGM document (canonical mm).
 */
export function parseDxfToIgm(dxfText: string, options: DxfParseOptions = {}): IgmDocument {
  const parser = new DxfParser();
  const dxf = parser.parseSync(dxfText);

  if (!dxf) {
    return {
      version: 1,
      units: 'mm',
      executable: false,
      layers: [],
      bounds: computeBounds([]),
      metadata: { source: 'dxf', error: 'Failed to parse DXF' },
    };
  }

  const scale = getDxfUnitScale(dxf, options.units) * (options.scale ?? 1);
  const subdivisions = Math.max(8, options.splineSubdivisions ?? 32);

  const layerTable = dxf.tables?.layer?.layers ?? {};
  const layerMap = new Map<string, IgmLayer>();

  const ensureLayer = (name: string): IgmLayer => {
    const id = name || '0';
    let layer = layerMap.get(id);
    if (!layer) {
      const def = layerTable[id];
      const color = dxfColorToHex(def?.color);
      layer = {
        id,
        name: def?.name ?? id,
        visible: def ? def.visible !== false && !def.frozen : true,
        ...(color ? { color } : {}),
        segments: [],
      };
      layerMap.set(id, layer);
    }
    return layer;
  };

  const pt = (p: { x: number; y: number; z?: number }) => ({
    x: p.x * scale,
    y: p.y * scale,
    z: (p.z ?? 0) * scale,
  });

  const entities: IEntity[] = dxf.entities ?? [];
  for (let idx = 0; idx < entities.length; idx++) {
    const entity = entities[idx];
    if (!entity) continue;

    const layer = ensureLayer(entity.layer || '0');
    const handleStr = entity.handle != null ? String(entity.handle) : '';
    const handle = handleStr !== '' ? handleStr : `dxf-${idx + 1}`;

    switch (entity.type) {
      case 'LINE': {
        const line = entity as ILineEntity;
        const v0 = line.vertices?.[0];
        const v1 = line.vertices?.[1];
        if (v0 && v1) {
          layer.segments.push({
            type: 'line',
            kind: 'geometry',
            start: pt(v0),
            end: pt(v1),
            layer: layer.id,
            sourceRef: { kind: 'dxf', handle },
          });
        }
        break;
      }

      case 'LWPOLYLINE': {
        const poly = entity as ILwpolylineEntity;
        const verts = poly.vertices ?? [];
        if (verts.length < 2) break;
        const z = (poly.elevation ?? 0) * scale;
        const count = poly.shape ? verts.length : verts.length - 1;
        for (let i = 0; i < count; i++) {
          const v0 = verts[i];
          const v1 = verts[(i + 1) % verts.length];
          if (!v0 || !v1) continue;
          const p0 = { x: v0.x * scale, y: v0.y * scale, z };
          const p1 = { x: v1.x * scale, y: v1.y * scale, z };
          if (v0.bulge && Math.abs(v0.bulge) > 1e-9) {
            layer.segments.push(bulgeToArcSegment(p0, p1, v0.bulge, layer.id, handle));
          } else {
            layer.segments.push({
              type: 'line',
              kind: 'geometry',
              start: p0,
              end: p1,
              layer: layer.id,
              sourceRef: { kind: 'dxf', handle },
            });
          }
        }
        break;
      }

      case 'POLYLINE': {
        const poly = entity as IPolylineEntity;
        const verts = poly.vertices ?? [];
        if (verts.length < 2) break;
        const count = poly.shape ? verts.length : verts.length - 1;
        for (let i = 0; i < count; i++) {
          const v0 = verts[i];
          const v1 = verts[(i + 1) % verts.length];
          if (!v0 || !v1) continue;
          const p0 = pt(v0);
          const p1 = pt(v1);
          const bulge = (v0 as unknown as { bulge?: number }).bulge;
          if (bulge && Math.abs(bulge) > 1e-9) {
            layer.segments.push(bulgeToArcSegment(p0, p1, bulge, layer.id, handle));
          } else {
            layer.segments.push({
              type: 'line',
              kind: 'geometry',
              start: p0,
              end: p1,
              layer: layer.id,
              sourceRef: { kind: 'dxf', handle },
            });
          }
        }
        break;
      }

      case 'CIRCLE': {
        const circle = entity as ICircleEntity;
        const center = pt(circle.center);
        const r = circle.radius * scale;
        if (r > 1e-9) {
          const startEnd = { x: center.x + r, y: center.y, z: center.z };
          layer.segments.push({
            type: 'arc',
            kind: 'geometry',
            start: startEnd,
            end: { ...startEnd },
            center,
            clockwise: false,
            plane: 'G17',
            layer: layer.id,
            sourceRef: { kind: 'dxf', handle },
          });
        }
        break;
      }

      case 'ARC': {
        const arc = entity as IArcEntity;
        const center = pt(arc.center);
        const r = arc.radius * scale;
        if (r > 1e-9) {
          // dxf-parser converts DXF arc angles to radians
          const startAngle = arc.startAngle;
          const endAngle = arc.endAngle;
          const start = {
            x: center.x + r * Math.cos(startAngle),
            y: center.y + r * Math.sin(startAngle),
            z: center.z,
          };
          const end = {
            x: center.x + r * Math.cos(endAngle),
            y: center.y + r * Math.sin(endAngle),
            z: center.z,
          };
          layer.segments.push({
            type: 'arc',
            kind: 'geometry',
            start,
            end,
            center,
            clockwise: false, // DXF arcs are always CCW from startAngle to endAngle
            plane: 'G17',
            layer: layer.id,
            sourceRef: { kind: 'dxf', handle },
          });
        }
        break;
      }

      case 'SPLINE': {
        const spline = entity as ISplineEntity;
        const pts = sampleSpline(spline, subdivisions);
        for (let i = 0; i + 1 < pts.length; i++) {
          const p0 = pts[i];
          const p1 = pts[i + 1];
          if (!p0 || !p1) continue;
          layer.segments.push({
            type: 'line',
            kind: 'geometry',
            start: pt(p0),
            end: pt(p1),
            layer: layer.id,
            sourceRef: { kind: 'dxf', handle },
          });
        }
        break;
      }

      case 'ELLIPSE': {
        const ell = entity as IEllipseEntity;
        const c = pt(ell.center);
        const mx = ell.majorAxisEndPoint.x * scale;
        const my = ell.majorAxisEndPoint.y * scale;
        const a = Math.hypot(mx, my);
        const b = a * (ell.axisRatio || 1);
        const rot = Math.atan2(my, mx);
        const cosR = Math.cos(rot);
        const sinR = Math.sin(rot);
        const t0 = ell.startAngle ?? 0;
        let t1 = ell.endAngle ?? Math.PI * 2;
        if (t1 <= t0) t1 += Math.PI * 2;
        const pts: Array<{ x: number; y: number; z: number }> = [];
        for (let i = 0; i <= subdivisions; i++) {
          const t = t0 + ((t1 - t0) * i) / subdivisions;
          const lx = a * Math.cos(t);
          const ly = b * Math.sin(t);
          pts.push({
            x: c.x + lx * cosR - ly * sinR,
            y: c.y + lx * sinR + ly * cosR,
            z: c.z,
          });
        }
        for (let i = 0; i + 1 < pts.length; i++) {
          const p0 = pts[i];
          const p1 = pts[i + 1];
          if (!p0 || !p1) continue;
          layer.segments.push({
            type: 'line',
            kind: 'geometry',
            start: p0,
            end: p1,
            layer: layer.id,
            sourceRef: { kind: 'dxf', handle },
          });
        }
        break;
      }

      default:
        break;
    }
  }

  const layers = Array.from(layerMap.values()).filter((l) => l.segments.length > 0);

  return {
    version: 1,
    units: 'mm',
    executable: false,
    layers,
    bounds: computeBounds(layers),
    metadata: {
      source: 'dxf',
      scale,
      entityCount: entities.length,
    },
  };
}
