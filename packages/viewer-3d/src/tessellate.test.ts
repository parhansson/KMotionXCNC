import { describe, expect, it } from 'vitest';
import type { IgmDocument, IgmSegment } from '@kmxcnc/igm';
import { projectPoint, tessellateIgm } from './tessellate';
import { createTessellateWorkerClient } from './tessellate.worker';
import { sourceRefEquals } from './types';

function makeDoc(segments: IgmSegment[], visible = true): IgmDocument {
  return {
    version: 1,
    units: 'mm',
    executable: true,
    layers: [
      {
        id: 'default',
        name: 'Default',
        visible,
        segments,
      },
    ],
    bounds: {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 0, y: 0, z: 0 },
      empty: segments.length === 0,
    },
  };
}

describe('tessellateIgm', () => {
  it('tessellates line segments grouped by MoveKind and preserves sourceRefs', () => {
    const doc = makeDoc([
      {
        type: 'line',
        kind: 'rapid',
        start: { x: 0, y: 0, z: 10 },
        end: { x: 20, y: 10, z: 10 },
        layer: 'default',
        sourceRef: { kind: 'gcode', line: 1 },
      },
      {
        type: 'line',
        kind: 'cut',
        start: { x: 20, y: 10, z: 10 },
        end: { x: 20, y: 10, z: -2 },
        layer: 'default',
        sourceRef: { kind: 'gcode', line: 2 },
      },
      {
        type: 'line',
        kind: 'cut',
        start: { x: 20, y: 10, z: -2 },
        end: { x: 50, y: 30, z: -2 },
        layer: 'default',
        sourceRef: { kind: 'gcode', line: 3 },
      },
    ]);

    const scene = tessellateIgm(doc);
    expect(scene.totalSegments).toBe(3);
    expect(scene.layers).toHaveLength(2);

    const rapidLayer = scene.layers.find((l) => l.kind === 'rapid');
    const cutLayer = scene.layers.find((l) => l.kind === 'cut');

    expect(rapidLayer).toBeDefined();
    expect(rapidLayer!.segmentCount).toBe(1);
    expect(Array.from(rapidLayer!.positions)).toEqual([0, 0, 10, 20, 10, 10]);
    expect(rapidLayer!.sourceRefs).toEqual([{ kind: 'gcode', line: 1 }]);

    expect(cutLayer).toBeDefined();
    expect(cutLayer!.segmentCount).toBe(2);
    expect(Array.from(cutLayer!.positions)).toEqual([
      20, 10, 10, 20, 10, -2,
      20, 10, -2, 50, 30, -2,
    ]);
    expect(cutLayer!.sourceRefs).toEqual([
      { kind: 'gcode', line: 2 },
      { kind: 'gcode', line: 3 },
    ]);

    expect(scene.bounds.min).toEqual({ x: 0, y: 0, z: -2 });
    expect(scene.bounds.max).toEqual({ x: 50, y: 30, z: 10 });
  });

  it('skips hidden layers', () => {
    const doc = makeDoc(
      [
        {
          type: 'line',
          kind: 'geometry',
          start: { x: 0, y: 0, z: 0 },
          end: { x: 10, y: 0, z: 0 },
          layer: 'default',
          sourceRef: { kind: 'svg', elementId: 'path-1' },
        },
      ],
      false,
    );

    const scene = tessellateIgm(doc);
    expect(scene.totalSegments).toBe(0);
    expect(scene.layers).toHaveLength(0);
    expect(scene.bounds).toEqual({
      min: { x: 0, y: 0, z: 0 },
      max: { x: 0, y: 0, z: 0 },
    });
  });

  it('tessellates G17 helical arcs with accurate Z interpolation and sourceRef mapping', () => {
    // 90-degree CCW quarter arc in XY plane from (10, 0, 0) to (0, 10, -4) around (0, 0)
    const doc = makeDoc([
      {
        type: 'arc',
        kind: 'cut',
        start: { x: 10, y: 0, z: 0 },
        end: { x: 0, y: 10, z: -4 },
        center: { x: 0, y: 0 },
        clockwise: false,
        plane: 'G17',
        layer: 'default',
        sourceRef: { kind: 'gcode', line: 42 },
      },
    ]);

    const scene = tessellateIgm(doc, { arcToleranceMm: 0.1 });
    expect(scene.layers).toHaveLength(1);
    const layer = scene.layers[0]!;
    expect(layer.segmentCount).toBeGreaterThan(4);

    // Every sub-segment maps back to line 42
    for (const ref of layer.sourceRefs) {
      expect(ref).toEqual({ kind: 'gcode', line: 42 });
    }

    const pos = layer.positions;
    // First vertex matches exact start
    expect(pos[0]).toBeCloseTo(10, 4);
    expect(pos[1]).toBeCloseTo(0, 4);
    expect(pos[2]).toBeCloseTo(0, 4);

    // Last vertex matches exact end
    const last = pos.length - 3;
    expect(pos[last]).toBeCloseTo(0, 4);
    expect(pos[last + 1]).toBeCloseTo(10, 4);
    expect(pos[last + 2]).toBeCloseTo(-4, 4);

    // Check every vertex lies on radius 10 and Z descends monotonically from 0 to -4
    let prevZ = pos[2]!;
    for (let i = 0; i < layer.segmentCount; i++) {
      const x1 = pos[i * 6]!;
      const y1 = pos[i * 6 + 1]!;
      const z1 = pos[i * 6 + 2]!;
      const x2 = pos[i * 6 + 3]!;
      const y2 = pos[i * 6 + 4]!;
      const z2 = pos[i * 6 + 5]!;

      expect(Math.hypot(x1, y1)).toBeCloseTo(10, 3);
      expect(Math.hypot(x2, y2)).toBeCloseTo(10, 3);
      expect(x1).toBeGreaterThanOrEqual(-1e-4);
      expect(y1).toBeGreaterThanOrEqual(-1e-4);
      expect(z2).toBeLessThanOrEqual(z1 + 1e-5);
      expect(z1).toBeLessThanOrEqual(prevZ + 1e-5);
      prevZ = z2;
    }
  });

  it('tessellates full 360-degree clockwise G17 circle when start equals end', () => {
    const doc = makeDoc([
      {
        type: 'arc',
        kind: 'cut',
        start: { x: 10, y: 0, z: 0 },
        end: { x: 10, y: 0, z: -2 },
        center: { x: 0, y: 0 },
        clockwise: true,
        plane: 'G17',
        layer: 'default',
        sourceRef: { kind: 'gcode', line: 10 },
      },
    ]);

    const scene = tessellateIgm(doc, { arcToleranceMm: 0.2 });
    const layer = scene.layers[0]!;
    expect(layer.segmentCount).toBeGreaterThanOrEqual(16);
    expect(scene.bounds.min.x).toBeCloseTo(-10, 1);
    expect(scene.bounds.max.x).toBeCloseTo(10, 1);
    expect(scene.bounds.min.y).toBeCloseTo(-10, 1);
    expect(scene.bounds.max.y).toBeCloseTo(10, 1);
    expect(scene.bounds.min.z).toBeCloseTo(-2, 4);
    expect(scene.bounds.max.z).toBeCloseTo(0, 4);
  });

  it('tessellates G18 (ZX) and G19 (YZ) helical arcs', () => {
    const doc = makeDoc([
      {
        type: 'arc',
        kind: 'cut',
        start: { x: 0, y: 0, z: 10 },
        end: { x: 10, y: 5, z: 0 },
        center: { x: 0, y: 0, z: 0 },
        clockwise: false,
        plane: 'G18',
        layer: 'default',
      },
      {
        type: 'arc',
        kind: 'cut',
        start: { x: 0, y: 10, z: 0 },
        end: { x: 4, y: 0, z: 10 },
        center: { x: 0, y: 0, z: 0 },
        clockwise: false,
        plane: 'G19',
        layer: 'default',
      },
    ]);

    const scene = tessellateIgm(doc, { arcToleranceMm: 0.25 });
    const layer = scene.layers[0]!;
    expect(layer.segmentCount).toBeGreaterThan(6);
    expect(scene.bounds.max.x).toBeCloseTo(10, 2);
    expect(scene.bounds.max.y).toBeCloseTo(10, 2);
    expect(scene.bounds.max.z).toBeCloseTo(10, 2);
  });

  it('projects 4th-axis rotary A moves cylindrically around X', () => {
    const rotary = { enabled: true, radiusMm: 20 };

    // A = 0 deg -> (x, 0, radius + z)
    const p0 = projectPoint({ x: 5, y: 0, z: 0, a: 0 }, rotary);
    expect(p0.x).toBeCloseTo(5, 5);
    expect(p0.y).toBeCloseTo(0, 5);
    expect(p0.z).toBeCloseTo(20, 5);

    // A = 90 deg -> (x, -20, 0)
    const p90 = projectPoint({ x: 5, y: 0, z: 0, a: 90 }, rotary);
    expect(p90.x).toBeCloseTo(5, 5);
    expect(p90.y).toBeCloseTo(-20, 5);
    expect(p90.z).toBeCloseTo(0, 5);

    // A = 180 deg with z = -2 -> radius 18 -> (x, 0, -18)
    const p180 = projectPoint({ x: 5, y: 0, z: -2, a: 180 }, rotary);
    expect(p180.x).toBeCloseTo(5, 5);
    expect(p180.y).toBeCloseTo(0, 5);
    expect(p180.z).toBeCloseTo(-18, 5);

    // Line move from A=0 to A=180 subdivides smoothly along the cylinder
    const doc = makeDoc([
      {
        type: 'line',
        kind: 'cut',
        start: { x: 0, y: 0, z: 0, a: 0 },
        end: { x: 10, y: 0, z: 0, a: 180 },
        layer: 'default',
        sourceRef: { kind: 'gcode', line: 7 },
      },
    ]);

    const scene = tessellateIgm(doc, { arcToleranceMm: 0.25, rotaryAxisA: rotary });
    const layer = scene.layers[0]!;
    expect(layer.segmentCount).toBeGreaterThan(8);

    // Every point lies on cylinder of radius 20 around X axis
    for (let i = 0; i < layer.segmentCount; i++) {
      const y = layer.positions[i * 6 + 1]!;
      const z = layer.positions[i * 6 + 2]!;
      expect(Math.hypot(y, z)).toBeCloseTo(20, 3);
      expect(layer.sourceRefs[i]).toEqual({ kind: 'gcode', line: 7 });
    }
  });

  it('falls back to main-thread tessellation in Node via createTessellateWorkerClient', async () => {
    const client = createTessellateWorkerClient();
    const doc = makeDoc([
      {
        type: 'line',
        kind: 'cut',
        start: { x: 0, y: 0, z: 0 },
        end: { x: 15, y: 25, z: -1 },
        layer: 'default',
        sourceRef: { kind: 'dxf', handle: 'A1' },
      },
    ]);

    const scene = await client.tessellate(doc);
    expect(scene.totalSegments).toBe(1);
    expect(scene.layers[0]!.sourceRefs[0]).toEqual({ kind: 'dxf', handle: 'A1' });
    client.dispose();
  });

  it('compares SourceRef values accurately with sourceRefEquals', () => {
    expect(sourceRefEquals({ kind: 'gcode', line: 5 }, { kind: 'gcode', line: 5 })).toBe(true);
    expect(sourceRefEquals({ kind: 'gcode', line: 5 }, { kind: 'gcode', line: 6 })).toBe(false);
    expect(sourceRefEquals({ kind: 'svg', elementId: 'e1' }, { kind: 'svg', elementId: 'e1' })).toBe(true);
    expect(sourceRefEquals({ kind: 'dxf', handle: 'H1' }, { kind: 'gcode', line: 1 })).toBe(false);
    expect(sourceRefEquals(null, null)).toBe(true);
    expect(sourceRefEquals(null, { kind: 'gcode', line: 1 })).toBe(false);
  });
});
