import { describe, expect, it } from 'vitest';
import { parseGcodeToIgm } from './gcode-to-igm';

describe('@kmxcnc/cam-engine RS274 subroutines, parameters, and canned cycles', () => {
  describe('M98 / O / M99 subroutines & loops', () => {
    it('executes M98 with L repeat count and stops cleanly at M30 without falling into O-subroutines', () => {
      const gcode = [
        'G21 G90',
        'G0 X0 Y0 Z5',
        'M98 P100 L3',
        'G0 Z10',
        'M30',
        'O100 (Step +10 in X)',
        'G91',
        'G1 X10 F500',
        'G90',
        'M99',
      ].join('\n');

      const doc = parseGcodeToIgm(gcode);
      const segs = doc.layers[0]?.segments ?? [];
      // 1 rapid (line 2) + 3 cuts from O100 (line 8) + 1 rapid Z10 (line 4)
      expect(segs).toHaveLength(5);

      expect(segs[0]?.kind).toBe('rapid');
      expect(segs[0]?.sourceRef).toEqual({ kind: 'gcode', line: 2 });

      expect(segs[1]?.end.x).toBeCloseTo(10, 6);
      expect(segs[2]?.end.x).toBeCloseTo(20, 6);
      expect(segs[3]?.end.x).toBeCloseTo(30, 6);
      // Every segment inside O100 carries callStack: [3]
      for (const s of [segs[1], segs[2], segs[3]]) {
        expect(s?.kind).toBe('cut');
        expect(s?.sourceRef).toEqual({ kind: 'gcode', line: 8, callStack: [3] });
      }

      // Final rapid after M98 returns, before M30
      expect(segs[4]?.kind).toBe('rapid');
      expect(segs[4]?.end.z).toBeCloseTo(10, 6);
      expect(segs[4]?.sourceRef).toEqual({ kind: 'gcode', line: 4 });
    });

    it('defaults L to 1 and skips subroutine call when L=0', () => {
      const gcode = [
        'G21 G91',
        'M98 P10',
        'M98 P10 L0',
        'M2',
        'O10',
        'G1 X5 F300',
        'M99',
      ].join('\n');

      const doc = parseGcodeToIgm(gcode);
      const segs = doc.layers[0]?.segments ?? [];
      expect(segs).toHaveLength(1);
      expect(segs[0]?.end.x).toBeCloseTo(5, 6);
      expect(segs[0]?.sourceRef).toEqual({ kind: 'gcode', line: 6, callStack: [2] });
    });

    it('tracks nested callStack across multi-level M98 calls', () => {
      const gcode = [
        'G21 G91',
        'M98 P100 L2',
        'M30',
        'O100',
        'M98 P200 L3',
        'M99',
        'O200',
        'G1 X1 F400',
        'M99',
      ].join('\n');

      const doc = parseGcodeToIgm(gcode);
      const segs = doc.layers[0]?.segments ?? [];
      // 2 * 3 = 6 segments
      expect(segs).toHaveLength(6);
      expect(segs[5]?.end.x).toBeCloseTo(6, 6);
      for (const seg of segs) {
        expect(seg.sourceRef).toEqual({ kind: 'gcode', line: 8, callStack: [2, 5] });
      }
    });

    it('guards against infinite recursion via maxCallDepth', () => {
      const gcode = [
        'G21 G91',
        'M98 P100',
        'M30',
        'O100',
        'G1 X1 F100',
        'M98 P100',
        'M99',
      ].join('\n');

      const doc = parseGcodeToIgm(gcode, { maxCallDepth: 5 });
      const segs = doc.layers[0]?.segments ?? [];
      // Initial call (depth 1) through depth 5 => 5 segments
      expect(segs).toHaveLength(5);
      const warnings = (doc.metadata?.warnings as string[] | undefined) ?? [];
      expect(warnings.some((w) => w.includes('Max subroutine call depth'))).toBe(true);
    });

    it('guards against excessive loop counts via maxIterations', () => {
      const gcode = [
        'G21 G91',
        'M98 P100 L999999',
        'M30',
        'O100',
        'G1 X1 F100',
        'M99',
      ].join('\n');

      const doc = parseGcodeToIgm(gcode, { maxIterations: 50 });
      const segs = doc.layers[0]?.segments ?? [];
      expect(segs.length).toBeGreaterThan(0);
      expect(segs.length).toBeLessThan(50);
      const warnings = (doc.metadata?.warnings as string[] | undefined) ?? [];
      expect(warnings.some((w) => w.includes('maxIterations'))).toBe(true);
    });
  });

  describe('#-parameters & RS274 expressions', () => {
    it('evaluates arithmetic, unary negation, nested brackets, MOD, and M98 L#n', () => {
      const gcode = [
        'G21 G90',
        '#1 = 10',
        '#2 = [#1 * 2 + 5]',
        '#3 = 3',
        '#4 = [17 MOD 5]',
        'G0 X[#1 + 10] Y[-#2] Z-[#4]',
        'M98 P100 L#3',
        'M30',
        'O100',
        '#1 = [#1 + 5]',
        'G1 X#1 Y0 F500',
        'M99',
      ].join('\n');

      const doc = parseGcodeToIgm(gcode);
      const segs = doc.layers[0]?.segments ?? [];
      expect(segs).toHaveLength(4);

      // Line 6: X=20, Y=-25, Z=-2
      expect(segs[0]?.end.x).toBeCloseTo(20, 6);
      expect(segs[0]?.end.y).toBeCloseTo(-25, 6);
      expect(segs[0]?.end.z).toBeCloseTo(-2, 6);

      // 3 calls to O100 incrementing #1 from 10 -> 15 -> 20 -> 25
      expect(segs[1]?.end.x).toBeCloseTo(15, 6);
      expect(segs[2]?.end.x).toBeCloseTo(20, 6);
      expect(segs[3]?.end.x).toBeCloseTo(25, 6);
    });

    it('evaluates RS274 trig and math functions (SIN, COS, TAN, SQRT, ABS, ROUND, FIX, FUP, ATAN)', () => {
      const gcode = [
        'G21 G90',
        '#1 = [SIN[30] * 20]', // 10
        '#2 = [COS[60] * 40]', // 20
        '#3 = [TAN[45] * 5]', // 5
        'G1 X#1 Y#2 Z#3 F300',
        '#4 = [SQRT[81] + ABS[-3]]', // 12
        '#5 = [ROUND[2.6] + FIX[-2.3] + FUP[2.1]]', // 3 + (-3) + 3 = 3
        '#6 = [ATAN[1]/[1]]', // 45
        'G1 X#4 Y#5 Z#6',
      ].join('\n');

      const doc = parseGcodeToIgm(gcode);
      const segs = doc.layers[0]?.segments ?? [];
      expect(segs).toHaveLength(2);

      expect(segs[0]?.end.x).toBeCloseTo(10, 5);
      expect(segs[0]?.end.y).toBeCloseTo(20, 5);
      expect(segs[0]?.end.z).toBeCloseTo(5, 5);

      expect(segs[1]?.end.x).toBeCloseTo(12, 5);
      expect(segs[1]?.end.y).toBeCloseTo(3, 5);
      expect(segs[1]?.end.z).toBeCloseTo(45, 5);
    });
  });

  describe('Canned drilling cycles (G81, G82, G83, G73, G98, G99, G80)', () => {
    it('expands G81 with G98 (retract to initial Z) and G99 (retract to R plane), then cancels with G80', () => {
      const gcode = [
        'G21 G90',
        'G0 X0 Y0 Z20',
        'G98 G81 X10 Y10 Z-5 R2 F200',
        'X20 Y10',
        'G99 X30 Y10',
        'G80',
        'G0 X0 Y0 Z20',
      ].join('\n');

      const doc = parseGcodeToIgm(gcode);
      const segs = doc.layers[0]?.segments ?? [];

      // Line 2: rapid to (0,0,20)
      expect(segs[0]?.kind).toBe('rapid');
      expect(segs[0]?.end).toEqual({ x: 0, y: 0, z: 20 });

      // Hole 1 (line 3, G98): rapid XY (10,10,20) -> rapid Z=2 -> cut Z=-5 -> rapid Z=20
      const hole1 = segs.filter((s) => s.sourceRef?.kind === 'gcode' && s.sourceRef.line === 3);
      expect(hole1).toHaveLength(4);
      expect(hole1[0]?.kind).toBe('rapid');
      expect(hole1[0]?.end).toEqual({ x: 10, y: 10, z: 20 });
      expect(hole1[1]?.kind).toBe('rapid');
      expect(hole1[1]?.end).toEqual({ x: 10, y: 10, z: 2 });
      expect(hole1[2]?.kind).toBe('cut');
      expect(hole1[2]?.end).toEqual({ x: 10, y: 10, z: -5 });
      expect(hole1[2]?.feedRate).toBe(200);
      expect(hole1[3]?.kind).toBe('rapid');
      expect(hole1[3]?.end).toEqual({ x: 10, y: 10, z: 20 });

      // Hole 2 (line 4, modal G81 + G98): rapid XY (20,10,20) -> rapid Z=2 -> cut Z=-5 -> rapid Z=20
      const hole2 = segs.filter((s) => s.sourceRef?.kind === 'gcode' && s.sourceRef.line === 4);
      expect(hole2).toHaveLength(4);
      expect(hole2[3]?.end.z).toBeCloseTo(20, 6);

      // Hole 3 (line 5, G99): rapid XY (30,10,20) -> rapid Z=2 -> cut Z=-5 -> rapid Z=2 (R plane!)
      const hole3 = segs.filter((s) => s.sourceRef?.kind === 'gcode' && s.sourceRef.line === 5);
      expect(hole3).toHaveLength(4);
      expect(hole3[3]?.kind).toBe('rapid');
      expect(hole3[3]?.end.z).toBeCloseTo(2, 6);

      // Line 7 after G80: regular rapid move
      const afterCancel = segs.filter(
        (s) => s.sourceRef?.kind === 'gcode' && s.sourceRef.line === 7,
      );
      expect(afterCancel).toHaveLength(1);
      expect(afterCancel[0]?.kind).toBe('rapid');
      expect(afterCancel[0]?.end).toEqual({ x: 0, y: 0, z: 20 });
    });

    it('expands G83 deep peck drilling with full retract to R plane between pecks', () => {
      const gcode = [
        'G21 G90',
        'G0 X0 Y0 Z10',
        'G98 G83 X10 Y10 Z-10 R2 Q4 F150',
        'G80',
      ].join('\n');

      const doc = parseGcodeToIgm(gcode);
      const holeSegs = (doc.layers[0]?.segments ?? []).filter(
        (s) => s.sourceRef?.kind === 'gcode' && s.sourceRef.line === 3,
      );

      // From R=2 to Z=-10 with Q=4 => 3 pecks: Z=-2, Z=-6, Z=-10
      const cutSegs = holeSegs.filter((s) => s.kind === 'cut');
      expect(cutSegs).toHaveLength(3);
      expect(cutSegs[0]?.end.z).toBeCloseTo(-2, 6);
      expect(cutSegs[1]?.end.z).toBeCloseTo(-6, 6);
      expect(cutSegs[2]?.end.z).toBeCloseTo(-10, 6);

      // Verify full retract to R=2 occurred between pecks
      const fullRetractsToR = holeSegs.filter(
        (s) => s.kind === 'rapid' && s.start.z < 0 && Math.abs(s.end.z - 2) < 1e-6,
      );
      expect(fullRetractsToR).toHaveLength(2);

      // Final retract to initial Z=10
      expect(holeSegs[holeSegs.length - 1]?.end.z).toBeCloseTo(10, 6);
    });

    it('expands G73 chip-break peck drilling with partial retract and supports G91 L repeat', () => {
      const gcode = [
        'G21 G90',
        'G0 X0 Y0 Z10',
        'G91 G99 G73 X10 Y0 Z-9 R-8 Q3 L2 F200',
        'G90 G80',
      ].join('\n');

      const doc = parseGcodeToIgm(gcode);
      const cycleSegs = (doc.layers[0]?.segments ?? []).filter(
        (s) => s.sourceRef?.kind === 'gcode' && s.sourceRef.line === 3,
      );

      // 2 holes at X=10 and X=20; R = 10 + (-8) = 2; Z = 2 + (-9) = -7; 3 pecks per hole => 6 cuts
      const cutSegs = cycleSegs.filter((s) => s.kind === 'cut');
      expect(cutSegs).toHaveLength(6);
      expect(cutSegs[0]?.end.x).toBeCloseTo(10, 6);
      expect(cutSegs[2]?.end.z).toBeCloseTo(-7, 6);
      expect(cutSegs[3]?.end.x).toBeCloseTo(20, 6);
      expect(cutSegs[5]?.end.z).toBeCloseTo(-7, 6);

      // Chip-break retracts do NOT go all the way back to R=2 after the first peck (from -1 to -0.25)
      const intermediateRetracts = cycleSegs.filter(
        (s) => s.kind === 'rapid' && s.start.z < 0 && s.end.z < 2 - 1e-6 && s.end.z > s.start.z,
      );
      expect(intermediateRetracts.length).toBeGreaterThanOrEqual(4);
    });
  });
});
