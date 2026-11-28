import { describe, expect, it } from 'vitest';
import { type ArcSegment, type StockBounds, computeBounds } from '@kmxcnc/igm';
import { parseGcodeToIgm } from '../gcode-to-igm';
import {
  evaluateHeidenhainToIgm,
  parseHeidenhainToAst,
  parseHeidenhainToIgm,
  transpileHeidenhainToGcode,
} from './index';

describe('Heidenhain Klartext parser, evaluator & transpiler', () => {
  it('parses BEGIN/END PGM, MM/INCH, BLK FORM stockBounds, L, CC/C, CR, LP/CP', () => {
    const src = `
0 BEGIN PGM DEMO_PART MM
1 BLK FORM 0.1 Z X+0 Y+0 Z-20
2 BLK FORM 0.2 X+100 Y+80 Z+0
3 TOOL CALL 1 Z S6000 F400
4 L Z+10 R0 FMAX M3
5 L X+10 Y+10 R0 FMAX
6 L Z-2 F200
7 L X+50 Y+10 RL F500 ; linear cut
8 CC X+50 Y+20
9 C X+60 Y+20 DR+ F500
10 CR X+50 Y+30 R+10 DR+ F500
11 CC X+50 Y+50
12 LP PR+20 PA+0 F500
13 CP IPA+90 DR+ F500
14 L Z+10 R0 FMAX M30
15 END PGM DEMO_PART MM
`;
    const ast = parseHeidenhainToAst(src);
    expect(ast.name).toBe('DEMO_PART');
    expect(ast.units).toBe('mm');
    expect(ast.warnings).toHaveLength(0);

    const res = evaluateHeidenhainToIgm(ast);
    expect(res.truncated).toBe(false);
    expect(res.stockBounds).toEqual({
      min: { x: 0, y: 0, z: -20 },
      max: { x: 100, y: 80, z: 0 },
    });
    expect(res.document.metadata?.stockBounds).toEqual(res.stockBounds);

    const segs = res.document.layers[0]!.segments;
    const arcs = segs.filter((s): s is ArcSegment => s.type === 'arc');
    expect(arcs).toHaveLength(3);
    // C arc: center (50, 20), DR+ -> CCW (clockwise: false), end (60, 20)
    expect(arcs[0]!.center.x).toBeCloseTo(50, 4);
    expect(arcs[0]!.center.y).toBeCloseTo(20, 4);
    expect(arcs[0]!.clockwise).toBe(false);
    // CR arc: start (60, 20) -> end (50, 30), R=10, DR+ -> center (50, 20)
    expect(arcs[1]!.center.x).toBeCloseTo(50, 4);
    expect(arcs[1]!.center.y).toBeCloseTo(20, 4);
    expect(arcs[1]!.end.x).toBeCloseTo(50, 4);
    expect(arcs[1]!.end.y).toBeCloseTo(30, 4);
    // CP arc: pole (50, 50), start (70, 50) -> IPA+90 DR+ -> end (50, 70)
    expect(arcs[2]!.end.x).toBeCloseTo(50, 4);
    expect(arcs[2]!.end.y).toBeCloseTo(70, 4);
  });

  it('converts INCH programs and BLK FORM to canonical mm', () => {
    const src = `
0 BEGIN PGM INCH_TEST INCH
1 BLK FORM 0.1 Z X+0 Y+0 Z-1
2 BLK FORM 0.2 X+4 Y+2 Z+0
3 L X+1 Y+2 Z+0 FMAX
4 L X+2 Y+2 F10
5 END PGM INCH_TEST INCH
`;
    const res = parseHeidenhainToIgm(src);
    const stock = res.stockBounds as StockBounds;
    expect(stock.max.x).toBeCloseTo(4 * 25.4, 4);
    expect(stock.max.y).toBeCloseTo(2 * 25.4, 4);
    expect(stock.min.z).toBeCloseTo(-25.4, 4);
    expect(res.document.bounds.max.x).toBeCloseTo(2 * 25.4, 4);
    expect(res.document.bounds.max.y).toBeCloseTo(2 * 25.4, 4);
    const cutSeg = res.document.layers[0]!.segments.find((s) => s.kind === 'cut');
    expect(cutSeg?.feedRate).toBeCloseTo(10 * 25.4, 4);
  });

  it('evaluates LBL / CALL LBL REP loops, nested calls, callStack, and infinite-loop guard', () => {
    const src = `
0 BEGIN PGM SUBS MM
1 L X+0 Y+0 Z+5 FMAX
2 CALL LBL 1 REP 2
3 M30
4 LBL 1
5 CALL LBL 2
6 L IX+10 F500
7 LBL 0
8 LBL 2
9 L IY+5 F500
10 L IY-5 F500
11 LBL 0
12 END PGM SUBS MM
`;
    const res = parseHeidenhainToIgm(src);
    expect(res.truncated).toBe(false);
    const segs = res.document.layers[0]!.segments;
    // REP 2 => 3 total executions of LBL 1; each executes LBL 2 (2 segs) + IX+10 (1 seg) = 3 segs/iter => 9 cut segs + 1 rapid
    const cuts = segs.filter((s) => s.kind === 'cut');
    expect(cuts).toHaveLength(9);
    // Final X should be 3 * 10 = 30
    expect(res.document.bounds.max.x).toBeCloseTo(30, 4);
    expect(res.document.bounds.max.y).toBeCloseTo(5, 4);
    // Nested callStack on LBL 2 segment should contain both CALL LBL 1 (line 3) and CALL LBL 2 (line 6)
    const nestedSeg = cuts[0]!;
    expect(nestedSeg.sourceRef?.kind).toBe('heidenhain');
    if (nestedSeg.sourceRef?.kind === 'heidenhain') {
      expect(nestedSeg.sourceRef.callStack).toHaveLength(2);
    }

    // Infinite loop guard via FN 9 unconditional GOTO
    const infSrc = `
0 BEGIN PGM INF MM
1 Q1 = 1
2 LBL 1
3 L IX+1 F500
4 FN 9: IF +Q1 EQU +1 GOTO LBL 1
5 END PGM INF MM
`;
    const infRes = parseHeidenhainToIgm(infSrc, { maxIterations: 200 });
    expect(infRes.truncated).toBe(true);
    expect(infRes.warnings.some((w) => w.includes('maxIterations'))).toBe(true);
  });

  it('evaluates Q-parameters, FN 0..8 math, and FN 9..12 conditional GOTO', () => {
    const src = `
0 BEGIN PGM MATH_TEST MM
1 FN 0: Q1 = +3
2 FN 0: Q2 = +4
3 FN 1: Q3 = +Q1 + +Q2
4 FN 2: Q4 = +Q2 - +Q1
5 FN 3: Q5 = +Q1 * +Q2
6 FN 4: Q6 = +Q5 DIV +2
7 FN 5: Q7 = SQRT +16
8 FN 6: Q8 = SIN +30
9 FN 7: Q9 = COS +60
10 FN 8: Q10 = +Q1 LEN +Q2
11 Q11 = 0
12 LBL 1
13 Q11 = Q11 + 1
14 L X+Q11 Y+0 F500
15 FN 12: IF +Q11 LT +5 GOTO LBL 1
16 END PGM MATH_TEST MM
`;
    const res = parseHeidenhainToIgm(src);
    expect(res.truncated).toBe(false);
    expect(res.qParams[3]).toBeCloseTo(7, 6);
    expect(res.qParams[4]).toBeCloseTo(1, 6);
    expect(res.qParams[5]).toBeCloseTo(12, 6);
    expect(res.qParams[6]).toBeCloseTo(6, 6);
    expect(res.qParams[7]).toBeCloseTo(4, 6);
    expect(res.qParams[8]).toBeCloseTo(0.5, 6);
    expect(res.qParams[9]).toBeCloseTo(0.5, 6);
    expect(res.qParams[10]).toBeCloseTo(5, 6);
    expect(res.qParams[11]).toBe(5);
    expect(res.document.bounds.max.x).toBeCloseTo(5, 4);
  });

  it('evaluates CYCL DEF 200 drilling, CYCL DEF 7 datum shift, CYCL DEF 10 rotation, CYCL DEF 220 bolt circle, and CYCL DEF 251 pocket', () => {
    // 1. Drilling + Datum shift + Rotation
    const drillTransformSrc = `
0 BEGIN PGM CYCLES MM
1 CYCL DEF 7.0 DATUM SHIFT
2 CYCL DEF 7.1 X+100
3 CYCL DEF 7.2 Y+50
4 CYCL DEF 10.0 ROTATION
5 CYCL DEF 10.1 ROT+90
6 CYCL DEF 200 DRILLING
  Q200=+2 ;SET-UP CLEARANCE
  Q201=-12 ;DEPTH
  Q202=+4 ;PLUNGING DEPTH
  Q203=+0 ;SURFACE COORDINATE
  Q204=+20 ;2ND SET-UP CLEARANCE
  Q206=+150 ;FEED RATE FOR PLNGNG
7 L X+10 Y+0 R0 FMAX
8 CYCL CALL
9 END PGM CYCLES MM
`;
    const drillRes = parseHeidenhainToIgm(drillTransformSrc);
    expect(drillRes.truncated).toBe(false);
    // Local (10, 0) rotated +90° => (0, 10), shifted by (100, 50) => (100, 60)
    expect(drillRes.document.bounds.max.x).toBeCloseTo(100, 4);
    expect(drillRes.document.bounds.max.y).toBeCloseTo(60, 4);
    expect(drillRes.document.bounds.min.z).toBeCloseTo(-12, 4);
    // 12mm depth with 4mm peck => 3 plunge cut segments
    const cutSegs = drillRes.document.layers[0]!.segments.filter((s) => s.kind === 'cut');
    expect(cutSegs).toHaveLength(3);

    // 2. Bolt-hole circle CYCL DEF 220
    const boltSrc = `
0 BEGIN PGM BOLT MM
1 CYCL DEF 200 DRILLING
  Q200=+2
  Q201=-10
  Q202=+10
  Q203=+0
  Q204=+15
  Q206=+200
2 CYCL DEF 220 POLAR PATTERN
  Q216=+50
  Q217=+50
  Q222=+40
  Q224=+0
  Q225=+90
  Q241=+4
3 CYCL CALL
4 END PGM BOLT MM
`;
    const boltRes = parseHeidenhainToIgm(boltSrc);
    // 4 holes on radius 20 around (50, 50) => cut segments X in [30, 70], Y in [30, 70], Z down to -10
    const boltCuts = boltRes.document.layers[0]!.segments.filter((s) => s.kind === 'cut');
    expect(boltCuts).toHaveLength(4);
    const boltCutBounds = computeBounds(boltCuts);
    expect(boltCutBounds.min.x).toBeCloseTo(30, 4);
    expect(boltCutBounds.max.x).toBeCloseTo(70, 4);
    expect(boltCutBounds.min.y).toBeCloseTo(30, 4);
    expect(boltCutBounds.max.y).toBeCloseTo(70, 4);
    expect(boltCutBounds.min.z).toBeCloseTo(-10, 4);

    // 3. Rectangular pocket CYCL DEF 251
    const pocketSrc = `
0 BEGIN PGM POCKET MM
1 L X+40 Y+30 Z+10 FMAX
2 CYCL DEF 251 RECTANGULAR POCKET
  Q218=+30
  Q219=+20
  Q200=+2
  Q201=-6
  Q202=+3
  Q203=+0
  Q204=+10
  Q206=+150
  Q207=+500
  Q370=+0.5
3 CYCL CALL
4 END PGM POCKET MM
`;
    const pocketRes = parseHeidenhainToIgm(pocketSrc, { toolDiameter: 6 });
    const pocketCuts = pocketRes.document.layers[0]!.segments.filter((s) => s.kind === 'cut');
    const pocketBounds = computeBounds(pocketCuts);
    expect(pocketBounds.min.z).toBeCloseTo(-6, 4);
    // Pocket centered at (40, 30), side 30x20, tool R=3 => toolpath X in [28, 52], Y in [23, 37]
    expect(pocketBounds.min.x).toBeCloseTo(28, 4);
    expect(pocketBounds.max.x).toBeCloseTo(52, 4);
    expect(pocketBounds.min.y).toBeCloseTo(23, 4);
    expect(pocketBounds.max.y).toBeCloseTo(37, 4);

    // 4. Circular pocket CYCL DEF 252 + Mirroring CYCL DEF 8
    const circSrc = `
0 BEGIN PGM CIRC_POCKET MM
1 CYCL DEF 8.0 MIRRORING
2 CYCL DEF 8.1 X
3 L X+30 Y+20 Z+10 FMAX
4 CYCL DEF 252 CIRCULAR POCKET
  Q223=+20
  Q200=+2
  Q201=-4
  Q202=+4
  Q203=+0
  Q204=+10
  Q206=+150
  Q207=+500
5 CYCL CALL
6 END PGM CIRC_POCKET MM
`;
    const circRes = parseHeidenhainToIgm(circSrc, { toolDiameter: 6 });
    const circArcs = circRes.document.layers[0]!.segments.filter(
      (s): s is ArcSegment => s.type === 'arc',
    );
    expect(circArcs.length).toBeGreaterThan(0);
    // Mirrored across X => center at (-30, 20), and CCW arc flips to CW
    expect(circArcs[0]!.center.x).toBeCloseTo(-30, 4);
    expect(circArcs[0]!.center.y).toBeCloseTo(20, 4);
    expect(circArcs[0]!.clockwise).toBe(true);
  });

  it('transpiles structured RS274 (O/M98/M99/#/G81/G83) and auto-falls back to flattened for unsupported constructs', () => {
    const structuredSrc = `
0 BEGIN PGM STRUCT_OK MM
1 TOOL CALL 2 Z S8000
2 Q1 = 10
3 FN 1: Q2 = +Q1 + +5
4 CYCL DEF 200 DRILLING
  Q200=+2
  Q201=-15
  Q202=+5
  Q203=+0
  Q206=+250
5 L X+Q2 Y+20 Z+5 R0 FMAX
6 CYCL CALL
7 CALL LBL 10 REP 2
8 M30
9 LBL 10
10 L IX+10 F600
11 LBL 0
12 END PGM STRUCT_OK MM
`;
    const ast = parseHeidenhainToAst(structuredSrc);
    const res = transpileHeidenhainToGcode(ast, { mode: 'structured' });
    expect(res.usedMode).toBe('structured');
    expect(res.fellBack).toBe(false);
    expect(res.gcode).toContain('G21');
    expect(res.gcode).toContain('T2 M6');
    expect(res.gcode).toContain('S8000 M3');
    expect(res.gcode).toContain('#1 = 10');
    expect(res.gcode).toContain('#2 = [#1 + 5]');
    expect(res.gcode).toContain('G83 Z-15 R2 Q5 F250');
    expect(res.gcode).toContain('G80');
    expect(res.gcode).toContain('M98 P10 L3');
    expect(res.gcode).toContain('O10');
    expect(res.gcode).toContain('M99');

    // Auto-fallback when FN 9..12 conditional GOTO is present
    const gotoSrc = `
0 BEGIN PGM FALLBACK_GOTO MM
1 Q1 = 0
2 LBL 1
3 Q1 = Q1 + 10
4 L X+Q1 Y+0 F500
5 FN 12: IF +Q1 LT +30 GOTO LBL 1
6 END PGM FALLBACK_GOTO MM
`;
    const fbGoto = transpileHeidenhainToGcode(parseHeidenhainToAst(gotoSrc), { mode: 'structured' });
    expect(fbGoto.requestedMode).toBe('structured');
    expect(fbGoto.usedMode).toBe('flattened');
    expect(fbGoto.fellBack).toBe(true);
    expect(fbGoto.warnings.some((w) => w.includes('FN 12'))).toBe(true);
    expect(fbGoto.gcode).toContain('G1 X30 Y0 Z0');

    // Auto-fallback when pocket cycle CYCL DEF 251 is present
    const pocketSrc = `
0 BEGIN PGM FALLBACK_POCKET MM
1 L X+20 Y+20 Z+5 FMAX
2 CYCL DEF 251 RECTANGULAR POCKET
  Q218=+20
  Q219=+10
  Q201=-4
  Q202=+4
3 CYCL CALL
4 END PGM FALLBACK_POCKET MM
`;
    const fbPocket = transpileHeidenhainToGcode(parseHeidenhainToAst(pocketSrc), {
      mode: 'structured',
    });
    expect(fbPocket.usedMode).toBe('flattened');
    expect(fbPocket.fellBack).toBe(true);
    expect(fbPocket.warnings.some((w) => w.includes('CYCL DEF 251'))).toBe(true);
  });

  it('transpiles polar LP/CP moves (bultcirkel + helical IZ) natively in structured RS274 and round-trips through parseGcodeToIgm', () => {
    const src = `
0 BEGIN PGM BULTCIRKEL MM
1 Q0 = 20
2 L Z+0 FMAX
3 CC X+50 Y+50
4 LP PR+Q0 PA+0 FMAX
5 CALL LBL 1 REP 3
6 M30
7 LBL 1
8 CP IPA+360 IZ-2 DR+ F500
9 LBL 0
10 END PGM BULTCIRKEL MM
`;
    const ast = parseHeidenhainToAst(src);
    const directEval = evaluateHeidenhainToIgm(ast);
    const transpiled = transpileHeidenhainToGcode(ast, { mode: 'structured' });

    expect(transpiled.usedMode).toBe('structured');
    expect(transpiled.fellBack).toBe(false);
    expect(transpiled.gcode).not.toMatch(/#0\b/);
    expect(transpiled.gcode).toContain('#4900 = 20');
    expect(transpiled.gcode).toContain('M98 P1 L4');
    expect(transpiled.gcode).toContain('G3 X#4906 Y#4907 Z#4910 I#4908 J#4909');

    const roundTrip = parseGcodeToIgm(transpiled.gcode);
    expect(roundTrip.bounds.min.x).toBeCloseTo(directEval.document.bounds.min.x, 2);
    expect(roundTrip.bounds.max.x).toBeCloseTo(directEval.document.bounds.max.x, 2);
    expect(roundTrip.bounds.min.y).toBeCloseTo(directEval.document.bounds.min.y, 2);
    expect(roundTrip.bounds.max.y).toBeCloseTo(directEval.document.bounds.max.y, 2);
    expect(roundTrip.bounds.min.z).toBeCloseTo(-8, 2);
    expect(roundTrip.bounds.min.z).toBeCloseTo(directEval.document.bounds.min.z, 2);
  });

  it('round-trips structured G-code with M98 back through parseGcodeToIgm with matching bounds and segment count', () => {
    const src = `
0 BEGIN PGM ROUNDTRIP MM
1 L X+0 Y+0 Z+5 R0 FMAX
2 L Z-2 F300
3 CALL LBL 5 REP 3
4 L Z+5 R0 FMAX
5 M30
6 LBL 5
7 L IX+10 F600
8 L IY+5 F600
9 L IY-5 F600
10 LBL 0
11 END PGM ROUNDTRIP MM
`;
    const ast = parseHeidenhainToAst(src);
    const evalRes = evaluateHeidenhainToIgm(ast);
    const transpiled = transpileHeidenhainToGcode(ast, { mode: 'structured' });
    expect(transpiled.usedMode).toBe('structured');
    expect(transpiled.gcode).toContain('M98 P5 L4');

    const roundTripIgm = parseGcodeToIgm(transpiled.gcode);
    const origSegs = evalRes.document.layers[0]!.segments;
    const rtSegs = roundTripIgm.layers[0]!.segments;

    expect(rtSegs.length).toBe(origSegs.length);
    expect(roundTripIgm.bounds.min.x).toBeCloseTo(evalRes.document.bounds.min.x, 3);
    expect(roundTripIgm.bounds.max.x).toBeCloseTo(evalRes.document.bounds.max.x, 3);
    expect(roundTripIgm.bounds.min.y).toBeCloseTo(evalRes.document.bounds.min.y, 3);
    expect(roundTripIgm.bounds.max.y).toBeCloseTo(evalRes.document.bounds.max.y, 3);
    expect(roundTripIgm.bounds.min.z).toBeCloseTo(evalRes.document.bounds.min.z, 3);
    expect(roundTripIgm.bounds.max.z).toBeCloseTo(evalRes.document.bounds.max.z, 3);
  });
});
