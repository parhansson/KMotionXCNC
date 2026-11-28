import { describe, expect, it } from 'vitest';
import {
  type ArcSegment,
  type IgmDocument,
  analyzePreflight,
  computeSegmentLength,
} from '@kmxcnc/igm';
import {
  MillPostProcessor,
  PostProcessorRegistry,
  igmToGcode,
  optimizeIgm,
  parseDxfToIgm,
  parseGcodeToIgm,
  parseKmxJob,
  parseSvgToIgm,
  safeParseKmxJob,
} from './index';

describe('@kmxcnc/cam-engine gcode-to-igm', () => {
  it('parses 8-axis G-code with modal state, G90/G91, and 1-based sourceRef line numbers', () => {
    const gcode = [
      '(Header comment)',
      'G21 G90 G17',
      'G0 X10 Y20 Z5 A90 B10 C20 U1 V2',
      'G1 X30 Y20 Z-1 F600',
      'G91',
      'X10 Y-5 A45 ; incremental move',
      'G90',
      'Z5',
    ].join('\n');

    const doc = parseGcodeToIgm(gcode);
    expect(doc.executable).toBe(true);
    expect(doc.units).toBe('mm');
    const segs = doc.layers[0]?.segments ?? [];
    expect(segs).toHaveLength(4);

    expect(segs[0]?.kind).toBe('rapid');
    expect(segs[0]?.sourceRef).toEqual({ kind: 'gcode', line: 3 });
    expect(segs[0]?.end).toEqual({
      x: 10,
      y: 20,
      z: 5,
      a: 90,
      b: 10,
      c: 20,
      u: 1,
      v: 2,
    });

    expect(segs[1]?.kind).toBe('cut');
    expect(segs[1]?.feedRate).toBe(600);
    expect(segs[1]?.sourceRef).toEqual({ kind: 'gcode', line: 4 });

    // Incremental move from (30, 20, -1, a=90) by (+10, -5, a=+45)
    expect(segs[2]?.end.x).toBeCloseTo(40, 6);
    expect(segs[2]?.end.y).toBeCloseTo(15, 6);
    expect(segs[2]?.end.z).toBeCloseTo(-1, 6);
    expect(segs[2]?.end.a).toBeCloseTo(135, 6);
    expect(segs[2]?.sourceRef).toEqual({ kind: 'gcode', line: 6 });
  });

  it('converts G20 inches to canonical mm while keeping rotary axes in degrees', () => {
    const gcode = [
      'G20 G90',
      'G0 X1 Y2 Z0.5 A180',
      'G1 X2 Y2 F10',
    ].join('\n');

    const doc = parseGcodeToIgm(gcode);
    const segs = doc.layers[0]?.segments ?? [];
    expect(segs).toHaveLength(2);
    expect(segs[0]?.end.x).toBeCloseTo(25.4, 5);
    expect(segs[0]?.end.y).toBeCloseTo(50.8, 5);
    expect(segs[0]?.end.z).toBeCloseTo(12.7, 5);
    expect(segs[0]?.end.a).toBeCloseTo(180, 5);
    expect(segs[1]?.end.x).toBeCloseTo(50.8, 5);
    expect(segs[1]?.feedRate).toBeCloseTo(254, 5);
  });

  it('parses helical I/J arcs and R-format arcs accurately', () => {
    const gcode = [
      'G21 G90 G17',
      'G0 X10 Y0 Z0',
      'G3 X-10 Y0 Z-2 I-10 J0 F500', // CCW helical semicircle
      'G2 X10 Y0 R10 F500', // CW semicircle using R
    ].join('\n');

    const doc = parseGcodeToIgm(gcode);
    const segs = doc.layers[0]?.segments ?? [];
    expect(segs).toHaveLength(3);

    const arc1 = segs[1] as ArcSegment;
    expect(arc1.type).toBe('arc');
    expect(arc1.clockwise).toBe(false);
    expect(arc1.center.x).toBeCloseTo(0, 5);
    expect(arc1.center.y).toBeCloseTo(0, 5);
    expect(arc1.start.z).toBeCloseTo(0, 5);
    expect(arc1.end.z).toBeCloseTo(-2, 5);
    // Bounds should include y=+10 from top of CCW semicircle
    expect(doc.bounds.max.y).toBeCloseTo(10, 5);

    const arc2 = segs[2] as ArcSegment;
    expect(arc2.type).toBe('arc');
    expect(arc2.clockwise).toBe(true);
    expect(arc2.center.x).toBeCloseTo(0, 5);
    expect(arc2.center.y).toBeCloseTo(0, 5);
  });
});

describe('@kmxcnc/cam-engine svg-to-igm', () => {
  it('parses SVG shapes, paths, groups, transforms, and mm units without DOM', () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="50mm" viewBox="0 0 100 50">
        <g id="cut-layer" stroke="#ff0000">
          <rect id="box1" x="10" y="10" width="20" height="10" />
          <path id="curve1" d="M 40 10 L 60 10 Q 70 10 70 20 Z" />
          <circle id="hole1" cx="85" cy="25" r="5" />
        </g>
        <g id="hidden-layer" display="none">
          <line id="ignored-line" x1="0" y1="0" x2="100" y2="50" />
        </g>
      </svg>
    `;

    const doc = parseSvgToIgm(svg, { flipY: true });
    expect(doc.executable).toBe(false);
    expect(doc.units).toBe('mm');
    expect(doc.layers).toHaveLength(2);

    const cutLayer = doc.layers.find((l) => l.id === 'cut-layer');
    const hiddenLayer = doc.layers.find((l) => l.id === 'hidden-layer');
    expect(cutLayer?.visible).toBe(true);
    expect(cutLayer?.color).toBe('#ff0000');
    expect(hiddenLayer?.visible).toBe(false);

    // Check sourceRef preservation
    const boxSegs = cutLayer?.segments.filter(
      (s) => s.sourceRef?.kind === 'svg' && s.sourceRef.elementId === 'box1',
    );
    expect(boxSegs).toHaveLength(4);
    expect(doc.bounds.min.x).toBeGreaterThanOrEqual(0);
    expect(doc.bounds.max.x).toBeCloseTo(100, 3);
  });
});

describe('@kmxcnc/cam-engine dxf-to-igm', () => {
  it('parses DXF LINE, CIRCLE, ARC, LWPOLYLINE with bulge, and layers', () => {
    const dxf = [
      '0', 'SECTION',
      '2', 'HEADER',
      '9', '$INSUNITS',
      '70', '4',
      '0', 'ENDSEC',
      '0', 'SECTION',
      '2', 'ENTITIES',
      '0', 'LINE',
      '5', 'A1',
      '8', 'cut',
      '10', '0', '20', '0', '30', '0',
      '11', '50', '21', '0', '31', '0',
      '0', 'CIRCLE',
      '5', 'A2',
      '8', 'holes',
      '10', '25', '20', '25', '30', '0',
      '40', '10',
      '0', 'ARC',
      '5', 'A3',
      '8', 'cut',
      '10', '0', '20', '0', '30', '0',
      '40', '20',
      '50', '0',
      '51', '90',
      '0', 'LWPOLYLINE',
      '5', 'A4',
      '8', 'cut',
      '90', '2',
      '70', '0',
      '10', '0', '20', '0', '42', '1',
      '10', '20', '20', '0',
      '0', 'ENDSEC',
      '0', 'EOF',
    ].join('\n');

    const doc = parseDxfToIgm(dxf);
    expect(doc.executable).toBe(false);
    expect(doc.layers.map((l) => l.id).sort()).toEqual(['cut', 'holes']);

    const cutLayer = doc.layers.find((l) => l.id === 'cut');
    const holesLayer = doc.layers.find((l) => l.id === 'holes');
    expect(cutLayer?.segments.some((s) => s.sourceRef?.kind === 'dxf' && s.sourceRef.handle === 'A1')).toBe(true);
    expect(cutLayer?.segments.some((s) => s.type === 'arc' && s.sourceRef?.kind === 'dxf' && s.sourceRef.handle === 'A3')).toBe(true);
    expect(cutLayer?.segments.some((s) => s.type === 'arc' && s.sourceRef?.kind === 'dxf' && s.sourceRef.handle === 'A4')).toBe(true);
    expect(holesLayer?.segments).toHaveLength(1);
    expect(holesLayer?.segments[0]?.type).toBe('arc');
  });
});

describe('@kmxcnc/cam-engine optimizer', () => {
  it('filters layers, translates to origin, removes singularities, joins collinear lines, and shortens travel path', () => {
    const doc: IgmDocument = {
      version: 1,
      units: 'mm',
      executable: false,
      layers: [
        {
          id: 'visible',
          name: 'Visible',
          visible: true,
          segments: [
            // Far contour first (at x=100..120)
            {
              type: 'line',
              kind: 'geometry',
              start: { x: 100, y: 10, z: 0 },
              end: { x: 110, y: 10, z: 0 },
              layer: 'visible',
            },
            // Zero-length singularity
            {
              type: 'line',
              kind: 'geometry',
              start: { x: 110, y: 10, z: 0 },
              end: { x: 110, y: 10, z: 0 },
              layer: 'visible',
            },
            // Collinear continuation (110..120)
            {
              type: 'line',
              kind: 'geometry',
              start: { x: 110, y: 10, z: 0 },
              end: { x: 120, y: 10, z: 0 },
              layer: 'visible',
            },
            // Near contour second (at x=10..20)
            {
              type: 'line',
              kind: 'geometry',
              start: { x: 10, y: 10, z: 0 },
              end: { x: 20, y: 10, z: 0 },
              layer: 'visible',
            },
          ],
        },
        {
          id: 'hidden',
          name: 'Hidden',
          visible: false,
          segments: [
            {
              type: 'line',
              kind: 'geometry',
              start: { x: 500, y: 500, z: 0 },
              end: { x: 600, y: 600, z: 0 },
              layer: 'hidden',
            },
          ],
        },
      ],
      bounds: { min: { x: 10, y: 10, z: 0 }, max: { x: 600, y: 600, z: 0 }, empty: false },
    };

    const opt = optimizeIgm(doc, {
      filterVisibleLayers: true,
      translateToOrigin: true,
      removeSingularities: true,
      joinAdjacent: true,
      shortestPath: true,
      startPoint: { x: 0, y: 0 },
    });

    expect(opt.layers).toHaveLength(1);
    const segs = opt.layers[0]?.segments ?? [];
    // Singularity removed + two collinear segments joined => 2 segments total
    expect(segs).toHaveLength(2);
    // Translated to origin => min X = 0, min Y = 0
    expect(opt.bounds.min.x).toBeCloseTo(0, 6);
    expect(opt.bounds.min.y).toBeCloseTo(0, 6);
    // Shortest path puts the near segment (0..10) BEFORE the far segment (90..110)
    expect(segs[0]?.start.x).toBeCloseTo(0, 6);
    expect(segs[0]?.end.x).toBeCloseTo(10, 6);
    expect(segs[1]?.start.x).toBeCloseTo(90, 6);
    expect(segs[1]?.end.x).toBeCloseTo(110, 6);
  });
});

describe('@kmxcnc/cam-engine postprocessor & roundtrip', () => {
  it('supports multipass mill G-code generation and roundtrips through gcode-to-igm', () => {
    const svg = `<svg width="20mm" height="20mm" viewBox="0 0 20 20"><rect x="0" y="0" width="20" height="20"/></svg>`;
    const cadDoc = parseSvgToIgm(svg, { flipY: true });

    const gcode = igmToGcode(cadDoc, {
      feedRate: 800,
      plungeFeedRate: 200,
      safeZ: 5,
      materialThickness: 6,
      passCount: 3,
      fractionalDigits: 3,
      initCode: ['(Start job)'],
      endCode: ['G0 X0 Y0', 'M30'],
    });

    expect(gcode).toContain('G21');
    expect(gcode).toContain('(Start job)');
    expect(gcode).toContain('Z-2');
    expect(gcode).toContain('Z-4');
    expect(gcode).toContain('Z-6');
    expect(gcode).toContain('M30');

    // Roundtrip back to executable IGM and run preflight
    const execDoc = parseGcodeToIgm(gcode);
    expect(execDoc.executable).toBe(true);
    expect(execDoc.bounds.min.z).toBeCloseTo(-6, 3);
    expect(execDoc.bounds.max.z).toBeCloseTo(5, 3);
    expect(execDoc.bounds.max.x).toBeCloseTo(20, 3);
    expect(execDoc.bounds.max.y).toBeCloseTo(20, 3);

    const preflight = analyzePreflight(execDoc, {
      dimX: 100,
      dimY: 100,
      softLimitNeg: { x: 0, y: 0, z: -10 },
      softLimitPos: { x: 100, y: 100, z: 20 },
    });
    expect(preflight.ok).toBe(true);
    // 3 passes * 80mm perimeter + 3 plunges * (5+2, 5+4, 5+6)
    expect(preflight.cutDistanceMm).toBeGreaterThan(240);
  });

  it('roundtrips executable G-code with arcs without losing geometry', () => {
    const original = [
      'G21',
      'G90',
      'G17',
      'G0 X0 Y0 Z5',
      'G1 Z-1 F300',
      'G1 X20 Y0 F600',
      'G3 X20 Y20 I0 J10 F600',
      'G0 Z5',
    ].join('\n');

    const doc1 = parseGcodeToIgm(original);
    const regenerated = igmToGcode(doc1, { fractionalDigits: 3 });
    const doc2 = parseGcodeToIgm(regenerated);

    const len1 = (doc1.layers[0]?.segments ?? []).reduce((s, seg) => s + computeSegmentLength(seg), 0);
    const len2 = (doc2.layers[0]?.segments ?? []).reduce((s, seg) => s + computeSegmentLength(seg), 0);
    expect(len2).toBeCloseTo(len1, 2);
    expect(doc2.bounds.max.x).toBeCloseTo(doc1.bounds.max.x, 2);
    expect(doc2.bounds.max.y).toBeCloseTo(doc1.bounds.max.y, 2);
  });

  it('allows plugins to register custom postprocessors in PostProcessorRegistry', () => {
    const registry = new PostProcessorRegistry([new MillPostProcessor()]);
    registry.register({
      id: 'laser',
      name: 'Laser PPI',
      generate: () => 'G21\nM100 P250 Q100\nM2\n',
    });

    expect(registry.has('laser')).toBe(true);
    expect(registry.list().map((p) => p.id)).toEqual(['mill', 'laser']);
    const out = igmToGcode(parseGcodeToIgm(''), {}, 'laser', registry);
    expect(out).toContain('M100 P250 Q100');
  });
});

describe('@kmxcnc/cam-engine job-schema', () => {
  it('validates *.kmxjob.json documents with Zod', () => {
    const valid = parseKmxJob({
      version: 1,
      name: 'Front Panel',
      source: { path: 'designs/panel.svg', format: 'svg' },
      visibleLayers: ['cut', 'engrave'],
      materialPreset: { id: 'ply-3mm', name: 'Birch Ply 3mm', thicknessMm: 3, feedRate: 800, passCount: 2 },
      optimize: { translateToOrigin: true, shortestPath: true },
      cam: { postProcessorId: 'mill', feedRate: 800, safeZ: 5, materialThickness: 3, passCount: 2 },
    });
    expect(valid.version).toBe(1);
    expect(valid.cam.postProcessorId).toBe('mill');

    const invalid = safeParseKmxJob({ version: 2, name: '' });
    expect(invalid.success).toBe(false);
  });
});
