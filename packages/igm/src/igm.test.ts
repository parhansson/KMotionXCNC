import { describe, expect, it } from 'vitest';
import {
  type ArcSegment,
  type IgmDocument,
  type LineSegment,
  analyzePreflight,
  computeBounds,
  computeSegmentLength,
  createEmptyDocument,
} from './index';

describe('@kmxcnc/igm bounds', () => {
  it('computes 8-axis bounds across linear and rotary axes', () => {
    const seg1: LineSegment = {
      type: 'line',
      kind: 'cut',
      start: { x: 0, y: 0, z: 0, a: 0, b: -15, u: 10 },
      end: { x: 50, y: -20, z: -5, a: 180, b: 45, c: 90, u: 25, v: -3 },
      feedRate: 600,
      layer: 'main',
    };

    const bounds = computeBounds([seg1]);
    expect(bounds.empty).toBe(false);
    expect(bounds.min).toEqual({
      x: 0,
      y: -20,
      z: -5,
      a: 0,
      b: -15,
      c: 90,
      u: 10,
      v: -3,
    });
    expect(bounds.max).toEqual({
      x: 50,
      y: 0,
      z: 0,
      a: 180,
      b: 45,
      c: 90,
      u: 25,
      v: -3,
    });
  });

  it('computes accurate arc cardinal extrema for G17, G18, G19 and full circles', () => {
    // Semicircle in G17 from (10, 0) to (-10, 0) CCW around (0, 0) -> top extremum at y = +10
    const semiCcw: ArcSegment = {
      type: 'arc',
      kind: 'cut',
      start: { x: 10, y: 0, z: 0 },
      end: { x: -10, y: 0, z: 0 },
      center: { x: 0, y: 0, z: 0 },
      clockwise: false,
      plane: 'G17',
      layer: 'l1',
    };
    const b1 = computeBounds([semiCcw]);
    expect(b1.min.x).toBeCloseTo(-10, 6);
    expect(b1.max.x).toBeCloseTo(10, 6);
    expect(b1.min.y).toBeCloseTo(0, 6);
    expect(b1.max.y).toBeCloseTo(10, 6);

    // Same endpoints CW -> bottom extremum at y = -10
    const semiCw: ArcSegment = { ...semiCcw, clockwise: true };
    const b2 = computeBounds([semiCw]);
    expect(b2.min.y).toBeCloseTo(-10, 6);
    expect(b2.max.y).toBeCloseTo(0, 6);

    // Full circle around (5, 5) radius 4 -> [1, 9] x [1, 9]
    const fullCircle: ArcSegment = {
      type: 'arc',
      kind: 'geometry',
      start: { x: 9, y: 5, z: 0 },
      end: { x: 9, y: 5, z: 0 },
      center: { x: 5, y: 5, z: 0 },
      clockwise: false,
      plane: 'G17',
      layer: 'l1',
    };
    const b3 = computeBounds([fullCircle]);
    expect(b3.min.x).toBeCloseTo(1, 6);
    expect(b3.max.x).toBeCloseTo(9, 6);
    expect(b3.min.y).toBeCloseTo(1, 6);
    expect(b3.max.y).toBeCloseTo(9, 6);

    // Helical arc length: 1 full turn radius 10 + dz = 6 -> sqrt((20*pi)^2 + 6^2)
    const helix: ArcSegment = {
      type: 'arc',
      kind: 'cut',
      start: { x: 10, y: 0, z: 0 },
      end: { x: 10, y: 0, z: -6 },
      center: { x: 0, y: 0, z: 0 },
      clockwise: false,
      plane: 'G17',
      layer: 'l1',
    };
    expect(computeSegmentLength(helix)).toBeCloseTo(Math.hypot(20 * Math.PI, 6), 6);
  });
});

describe('@kmxcnc/igm preflight', () => {
  it('checks soft limits (including rotary A), envelope, distances, and estimated time', () => {
    const doc: IgmDocument = {
      version: 1,
      units: 'mm',
      executable: true,
      layers: [
        {
          id: 'gcode',
          name: 'G-Code',
          visible: true,
          segments: [
            {
              type: 'line',
              kind: 'rapid',
              start: { x: 0, y: 0, z: 5, a: 0 },
              end: { x: 30, y: 40, z: 5, a: 0 }, // 50 mm rapid
              layer: 'gcode',
            },
            {
              type: 'line',
              kind: 'cut',
              start: { x: 30, y: 40, z: 5, a: 0 },
              end: { x: 130, y: 40, z: 5, a: 400 }, // 100 mm cut at 600 mm/min = 10s
              feedRate: 600,
              layer: 'gcode',
            },
          ],
        },
      ],
      bounds: { min: { x: 0, y: 0, z: 5 }, max: { x: 130, y: 40, z: 5 }, empty: false },
    };

    // Passes when within limits
    const okRes = analyzePreflight(doc, {
      dimX: 200,
      dimY: 200,
      dimZ: 100,
      softLimitNeg: { x: 0, y: 0, z: -50, a: -360 },
      softLimitPos: { x: 200, y: 200, z: 50, a: 720 },
      rapidFeedRateMmPerMin: 3000, // 50mm / 3000 * 60 = 1s
    });
    expect(okRes.ok).toBe(true);
    expect(okRes.errors).toHaveLength(0);
    expect(okRes.rapidDistanceMm).toBeCloseTo(50, 6);
    expect(okRes.cutDistanceMm).toBeCloseTo(100, 6);
    expect(okRes.estimatedTimeSec).toBeCloseTo(11, 6);
    expect(okRes.segmentCount).toBe(2);

    // Fails when exceeding X soft limit and rotary A soft limit
    const failRes = analyzePreflight(doc, {
      dimX: 100,
      softLimitPos: { x: 120, a: 360 },
    });
    expect(failRes.ok).toBe(false);
    const codes = failRes.errors.map((e) => `${e.code}:${e.axis}`);
    expect(codes).toContain('SOFT_LIMIT_MAX_EXCEEDED:x');
    expect(codes).toContain('SOFT_LIMIT_MAX_EXCEEDED:a');
    expect(codes).toContain('ENVELOPE_EXCEEDED:x');
  });

  it('warns on empty document', () => {
    const empty = createEmptyDocument(true);
    const res = analyzePreflight(empty, { dimX: 100, dimY: 100 });
    expect(res.ok).toBe(true);
    expect(res.warnings.some((w) => w.code === 'EMPTY_DOCUMENT')).toBe(true);
  });
});
