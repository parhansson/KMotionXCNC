import type { IgmDocument } from '@kmxcnc/igm';
import type {
  CyclDefNode,
  HeidenhainExpr,
  HeidenhainProgram,
  HeidenhainStatement,
  QParamAssignNode,
  RadiusComp,
} from './ast';
import {
  type HeidenhainEvalOptions,
  type HeidenhainEvalResult,
  evalHeidenhainExpr,
  evaluateHeidenhainToIgm,
} from './evaluator';
import { parseHeidenhainToAst } from './parser';

export type HeidenhainTranspileMode = 'structured' | 'flattened';

export interface HeidenhainTranspileOptions {
  /** 'structured' emits native KMotionX RS274 (O/M98/M99/#/G81/G83) with auto-fallback; 'flattened' emits evaluated IGM moves. Default: 'structured'. */
  mode?: HeidenhainTranspileMode;
  /** Decimal digits for numeric formatting. Default: 3. */
  fractionalDigits?: number;
  /** Options passed to evaluateHeidenhainToIgm when flattening or falling back. */
  evalOptions?: HeidenhainEvalOptions;
}

export interface HeidenhainTranspileResult {
  gcode: string;
  requestedMode: HeidenhainTranspileMode;
  usedMode: HeidenhainTranspileMode;
  fellBack: boolean;
  warnings: string[];
}

function rs274Comment(text: string): string {
  // RS274NGC forbids ';' comments and nested parentheses inside comments
  const safe = text.replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
  return `(${safe})`;
}

function formatNum(val: number, digits: number): string {
  const fixed = val.toFixed(digits);
  if (/^-0(\.0+)?$/.test(fixed)) {
    return '0';
  }
  return digits > 0 ? fixed.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '') : fixed;
}

/**
 * Maps a Heidenhain Q-parameter index to a valid RS274NGC `#<n>` parameter (`1 <= n <= 5399`).
 * Heidenhain allows `Q0`, whereas RS274NGC rejects `#0` ("Parameter number out of range"),
 * so `Q0` is mapped to `#4900`.
 */
function qParamToRs274(qIndex: number): string {
  const mapped = qIndex === 0 ? 4900 : qIndex;
  return `#${mapped}`;
}

function exprToRs274(expr: HeidenhainExpr, digits: number): string {
  switch (expr.type) {
    case 'number':
      return formatNum(expr.value, digits);
    case 'qparam':
      return qParamToRs274(expr.index);
    case 'unary': {
      const inner = exprToRs274(expr.operand, digits);
      return expr.op === '-' ? `[-${inner}]` : inner;
    }
    case 'binary': {
      const l = exprToRs274(expr.left, digits);
      const r = exprToRs274(expr.right, digits);
      return `[${l}${expr.op}${r}]`;
    }
  }
}

function exprToRs274WordValue(expr: HeidenhainExpr, digits: number): string {
  if (expr.type === 'number') {
    return formatNum(expr.value, digits);
  }
  if (expr.type === 'qparam') {
    return qParamToRs274(expr.index);
  }
  return exprToRs274(expr, digits);
}

function fnAssignToRs274(stmt: QParamAssignNode, digits: number): string {
  const target = qParamToRs274(stmt.target);
  const e1 = exprToRs274(stmt.expr, digits);
  const e2 = stmt.operand2 ? exprToRs274(stmt.operand2, digits) : '0';

  switch (stmt.op) {
    case 'assign':
      return `${target} = ${e1}`;
    case 'add':
      return `${target} = [${e1} + ${e2}]`;
    case 'sub':
      return `${target} = [${e1} - ${e2}]`;
    case 'mul':
      return `${target} = [${e1} * ${e2}]`;
    case 'div':
      return `${target} = [${e1} / ${e2}]`;
    case 'sqrt':
      return `${target} = SQRT[${e1}]`;
    case 'sin':
      return `${target} = SIN[${e1}]`;
    case 'cos':
      return `${target} = COS[${e1}]`;
    case 'len':
      return `${target} = SQRT[[${e1} * ${e1}] + [${e2} * ${e2}]]`;
  }
}

function hasSubroutineEnd(statements: HeidenhainStatement[], labelIp: number): boolean {
  for (let i = labelIp + 1; i < statements.length; i++) {
    const s = statements[i]!;
    if (s.type === 'label_def' && s.label === 0) return true;
    if (s.type === 'end_pgm') return false;
  }
  return false;
}

/**
 * Inspects a Klartext AST for constructs that KMotionX rs274ngc does not support natively.
 */
function detectStructuredBlockers(program: HeidenhainProgram): string[] {
  const reasons: string[] = [];
  const labelIndices = new Map<string, number>();

  for (let i = 0; i < program.statements.length; i++) {
    const s = program.statements[i]!;
    if (s.type === 'label_def' && s.label !== 0) {
      labelIndices.set(String(s.label), i);
      if (typeof s.label !== 'number') {
        reasons.push(
          `Line ${s.line}: named label "${s.label}" is not supported by RS274 O<n> subroutines`,
        );
      }
    }
  }

  for (let i = 0; i < program.statements.length; i++) {
    const s = program.statements[i]!;
    switch (s.type) {
      case 'fn_goto':
        reasons.push(
          `Line ${s.line}: FN ${s.fnNumber} conditional IF/GOTO is not natively supported by KMotionX rs274ngc`,
        );
        break;
      case 'cycl_def':
        if (s.cycleNumber !== 1 && s.cycleNumber !== 200) {
          reasons.push(
            `Line ${s.line}: CYCL DEF ${s.cycleNumber} (${s.name || 'cycle'}) is not natively supported by KMotionX rs274ngc`,
          );
        }
        break;
      case 'call_label': {
        if (typeof s.label !== 'number') {
          reasons.push(`Line ${s.line}: CALL LBL "${s.label}" requires numeric label for M98 P<n>`);
        } else {
          const defIdx = labelIndices.get(String(s.label));
          if (defIdx !== undefined && defIdx < i && !hasSubroutineEnd(program.statements.slice(0, i), defIdx)) {
            reasons.push(
              `Line ${s.line}: backward section repeat CALL LBL ${s.label} without LBL 0 requires flattening`,
            );
          }
        }
        break;
      }
      case 'linear': {
        const axes = [
          { expr: s.x, inc: Boolean(s.incremental.x) },
          { expr: s.y, inc: Boolean(s.incremental.y) },
          { expr: s.z, inc: Boolean(s.incremental.z) },
          { expr: s.a, inc: Boolean(s.incremental.a) },
          { expr: s.b, inc: Boolean(s.incremental.b) },
          { expr: s.c, inc: Boolean(s.incremental.c) },
        ].filter((a) => a.expr !== undefined);
        const hasInc = axes.some((a) => a.inc);
        const hasAbs = axes.some((a) => !a.inc);
        if (hasInc && hasAbs) {
          reasons.push(
            `Line ${s.line}: mixed absolute and incremental axes in single L block requires flattening`,
          );
        }
        break;
      }
      case 'arc': {
        if (s.incremental.x || s.incremental.y || s.incremental.z) {
          reasons.push(`Line ${s.line}: incremental arc (C) requires flattening`);
        }
        break;
      }
      default:
        break;
    }
  }

  return reasons;
}

/**
 * Emits clean, deterministic RS274 G-code from an evaluated flat IGM document.
 */
function emitFlattenedGcode(
  program: HeidenhainProgram,
  doc: IgmDocument,
  digits: number,
): string {
  const fmt = (v: number) => formatNum(v, digits);
  const lines: string[] = [];
  lines.push(rs274Comment(`Transpiled from Heidenhain Klartext: ${program.name} - flattened`));
  lines.push('G21');
  lines.push('G90');
  lines.push('G17');

  // Emit initial tool call / spindle speed if present before first move
  let spindleStarted = false;
  for (const stmt of program.statements) {
    if (stmt.type === 'tool_call') {
      if (typeof stmt.tool === 'number') {
        lines.push(`T${stmt.tool} M6`);
      } else {
        lines.push(rs274Comment(`Tool: ${stmt.tool}`));
      }
      if (stmt.spindleSpeed && stmt.spindleSpeed.type === 'number' && stmt.spindleSpeed.value > 0) {
        lines.push(`S${fmt(stmt.spindleSpeed.value)} M3`);
        spindleStarted = true;
      }
      break;
    }
    if (
      stmt.type === 'linear' ||
      stmt.type === 'arc' ||
      stmt.type === 'arc_radius' ||
      stmt.type === 'polar_linear' ||
      stmt.type === 'polar_arc'
    ) {
      break;
    }
  }

  let currentFeed: number | undefined;

  for (const layer of doc.layers) {
    if (!layer.visible) continue;
    for (const seg of layer.segments) {
      if (seg.type === 'line') {
        const cmd = seg.kind === 'rapid' ? 'G0' : 'G1';
        const parts = [cmd, `X${fmt(seg.end.x)}`, `Y${fmt(seg.end.y)}`, `Z${fmt(seg.end.z)}`];
        if (seg.end.a !== undefined) parts.push(`A${fmt(seg.end.a)}`);
        if (seg.end.b !== undefined) parts.push(`B${fmt(seg.end.b)}`);
        if (seg.end.c !== undefined) parts.push(`C${fmt(seg.end.c)}`);
        if (seg.kind !== 'rapid' && seg.feedRate !== undefined) {
          const rounded = Number(fmt(seg.feedRate));
          if (rounded !== currentFeed) {
            parts.push(`F${fmt(seg.feedRate)}`);
            currentFeed = rounded;
          }
        }
        lines.push(parts.join(' '));
      } else {
        const cmd = seg.clockwise ? 'G2' : 'G3';
        const iOff = seg.center.x - seg.start.x;
        const jOff = seg.center.y - seg.start.y;
        const parts = [
          cmd,
          `X${fmt(seg.end.x)}`,
          `Y${fmt(seg.end.y)}`,
          `Z${fmt(seg.end.z)}`,
          `I${fmt(iOff)}`,
          `J${fmt(jOff)}`,
        ];
        if (seg.feedRate !== undefined) {
          const rounded = Number(fmt(seg.feedRate));
          if (rounded !== currentFeed) {
            parts.push(`F${fmt(seg.feedRate)}`);
            currentFeed = rounded;
          }
        }
        lines.push(parts.join(' '));
      }
    }
  }

  if (spindleStarted) {
    lines.push('M5');
  }
  lines.push('M30');
  return lines.join('\n') + '\n';
}

/**
 * Emits structured KMotionX RS274 G-code preserving subroutines (O/M98/M99),
 * #-parameters, radius compensation (G41/G42/G40), and simple drilling cycles (G81/G83/G80).
 */
function emitStructuredGcode(program: HeidenhainProgram, digits: number): string {
  const fmt = (v: number) => formatNum(v, digits);
  const mainLines: string[] = [];
  const subLines: string[] = [];

  const usesPolar = program.statements.some(
    (s) => s.type === 'polar_linear' || s.type === 'polar_arc',
  );

  mainLines.push(rs274Comment(`Transpiled from Heidenhain Klartext: ${program.name} - structured`));
  mainLines.push(program.units === 'in' ? 'G20' : 'G21');
  mainLines.push('G90');
  mainLines.push('G17');
  if (usesPolar) {
    // Reserved runtime parameters for polar moves (LP/CP):
    // #4901/#4902 = pole X/Y (CC), #4903 = PR, #4904 = PA (deg),
    // #4906/#4907 = current X/Y, #4910 = current Z (for helical IZ on CP/LP)
    mainLines.push('#4901 = 0');
    mainLines.push('#4902 = 0');
    mainLines.push('#4903 = 0');
    mainLines.push('#4904 = 0');
    mainLines.push('#4906 = 0');
    mainLines.push('#4907 = 0');
    mainLines.push('#4910 = 0');
  }

  let inSubroutine = false;
  let mainEnded = false;
  let activeComp: RadiusComp = 'R0';
  let activeDrillCycle: CyclDefNode | undefined;
  // Track static numeric position & circle center for CC + C I/J emission
  let curX = 0;
  let curY = 0;
  let ccX = 0;
  let ccY = 0;
  const staticQ: Record<number, number> = {};

  const targetOut = (): string[] => (inSubroutine ? subLines : mainLines);

  const emitCompIfChanged = (comp: RadiusComp | undefined, out: string[]): void => {
    if (!comp || comp === activeComp) return;
    if (comp === 'RL') out.push('G41');
    else if (comp === 'RR') out.push('G42');
    else out.push('G40');
    activeComp = comp;
  };

  const emitDrillCall = (out: string[]): void => {
    if (!activeDrillCycle) return;
    const getVal = (q: number, def: number): number => {
      const expr = activeDrillCycle!.params[q];
      return expr ? evalHeidenhainExpr(expr, staticQ) : def;
    };
    const setupClearance = Math.abs(getVal(200, 2));
    const depthRaw = getVal(201, -10);
    const depth = depthRaw <= 0 ? depthRaw : -depthRaw;
    const peck = Math.abs(getVal(202, 0));
    const surfaceZ = getVal(203, 0);
    const feed = Math.abs(getVal(206, 200)) || 200;

    const rPlane = surfaceZ + setupClearance;
    const zFinal = surfaceZ + depth;

    if (peck > 1e-6 && peck < Math.abs(depth) - 1e-6) {
      out.push(`G83 Z${fmt(zFinal)} R${fmt(rPlane)} Q${fmt(peck)} F${fmt(feed)}`);
    } else {
      out.push(`G81 Z${fmt(zFinal)} R${fmt(rPlane)} F${fmt(feed)}`);
    }
    out.push('G80');
  };

  for (const stmt of program.statements) {
    switch (stmt.type) {
      case 'begin_pgm':
      case 'blk_form':
        break;

      case 'end_pgm':
        break;

      case 'tool_call': {
        const out = targetOut();
        if (typeof stmt.tool === 'number') {
          out.push(`T${stmt.tool} M6`);
        } else {
          out.push(rs274Comment(`TOOL CALL ${stmt.tool}`));
        }
        if (stmt.spindleSpeed) {
          out.push(`S${exprToRs274WordValue(stmt.spindleSpeed, digits)} M3`);
        }
        if (stmt.feedRate) {
          out.push(`F${exprToRs274WordValue(stmt.feedRate, digits)}`);
        }
        break;
      }

      case 'linear': {
        const out = targetOut();
        emitCompIfChanged(stmt.comp, out);
        const isInc =
          Boolean(stmt.incremental.x) ||
          Boolean(stmt.incremental.y) ||
          Boolean(stmt.incremental.z) ||
          Boolean(stmt.incremental.a) ||
          Boolean(stmt.incremental.b) ||
          Boolean(stmt.incremental.c);

        if (isInc) out.push('G91');

        const parts: string[] = [stmt.fMax ? 'G0' : 'G1'];
        if (stmt.x) {
          parts.push(`X${exprToRs274WordValue(stmt.x, digits)}`);
          const v = evalHeidenhainExpr(stmt.x, staticQ);
          curX = isInc ? curX + v : v;
        }
        if (stmt.y) {
          parts.push(`Y${exprToRs274WordValue(stmt.y, digits)}`);
          const v = evalHeidenhainExpr(stmt.y, staticQ);
          curY = isInc ? curY + v : v;
        }
        if (stmt.z) parts.push(`Z${exprToRs274WordValue(stmt.z, digits)}`);
        if (stmt.a) parts.push(`A${exprToRs274WordValue(stmt.a, digits)}`);
        if (stmt.b) parts.push(`B${exprToRs274WordValue(stmt.b, digits)}`);
        if (stmt.c) parts.push(`C${exprToRs274WordValue(stmt.c, digits)}`);
        if (!stmt.fMax && stmt.feedRate) {
          parts.push(`F${exprToRs274WordValue(stmt.feedRate, digits)}`);
        }
        if (stmt.mCodes) {
          for (const m of stmt.mCodes) {
            if (m === 99) continue; // Heidenhain M99 = cycle call
            if (m === 30 || m === 2) mainEnded = true;
            parts.push(`M${m}`);
          }
        }
        out.push(parts.join(' '));

        if (isInc) out.push('G90');
        if (usesPolar && (stmt.x || stmt.y || stmt.z)) {
          if (stmt.x) {
            const xVal = exprToRs274(stmt.x, digits);
            out.push(isInc ? `#4906 = [#4906 + ${xVal}]` : `#4906 = ${xVal}`);
          }
          if (stmt.y) {
            const yVal = exprToRs274(stmt.y, digits);
            out.push(isInc ? `#4907 = [#4907 + ${yVal}]` : `#4907 = ${yVal}`);
          }
          if (stmt.z) {
            const zVal = exprToRs274(stmt.z, digits);
            out.push(isInc ? `#4910 = [#4910 + ${zVal}]` : `#4910 = ${zVal}`);
          }
          if (stmt.x || stmt.y) {
            out.push(
              '#4903 = SQRT[[[#4906 - #4901] * [#4906 - #4901]] + [[#4907 - #4902] * [#4907 - #4902]]]',
            );
            out.push('#4904 = ATAN[#4907 - #4902]/[#4906 - #4901]');
          }
        }
        if (stmt.mCodes?.includes(99) || stmt.mCode === 99) {
          emitDrillCall(out);
        }
        break;
      }

      case 'circle_center': {
        if (stmt.x) {
          const v = evalHeidenhainExpr(stmt.x, staticQ);
          ccX = stmt.incremental.x ? curX + v : v;
        } else {
          ccX = curX;
        }
        if (stmt.y) {
          const v = evalHeidenhainExpr(stmt.y, staticQ);
          ccY = stmt.incremental.y ? curY + v : v;
        } else {
          ccY = curY;
        }
        if (usesPolar) {
          const out = targetOut();
          if (stmt.x) {
            const xv = exprToRs274(stmt.x, digits);
            out.push(stmt.incremental.x ? `#4901 = [#4906 + ${xv}]` : `#4901 = ${xv}`);
          } else {
            out.push('#4901 = #4906');
          }
          if (stmt.y) {
            const yv = exprToRs274(stmt.y, digits);
            out.push(stmt.incremental.y ? `#4902 = [#4907 + ${yv}]` : `#4902 = ${yv}`);
          } else {
            out.push('#4902 = #4907');
          }
          out.push(
            '#4903 = SQRT[[[#4906 - #4901] * [#4906 - #4901]] + [[#4907 - #4902] * [#4907 - #4902]]]',
          );
          out.push('#4904 = ATAN[#4907 - #4902]/[#4906 - #4901]');
        }
        break;
      }

      case 'polar_linear': {
        const out = targetOut();
        emitCompIfChanged(stmt.comp, out);
        if (stmt.pr) {
          const rv = exprToRs274(stmt.pr, digits);
          out.push(stmt.incrementalPr ? `#4903 = [#4903 + ${rv}]` : `#4903 = ${rv}`);
        }
        if (stmt.pa) {
          const av = exprToRs274(stmt.pa, digits);
          out.push(stmt.incrementalPa ? `#4904 = [#4904 + ${av}]` : `#4904 = ${av}`);
        }
        out.push('#4906 = [#4901 + [#4903 * COS[#4904]]]');
        out.push('#4907 = [#4902 + [#4903 * SIN[#4904]]]');
        if (stmt.z) {
          const zv = exprToRs274(stmt.z, digits);
          out.push(stmt.incrementalZ ? `#4910 = [#4910 + ${zv}]` : `#4910 = ${zv}`);
        }

        const parts: string[] = [stmt.fMax ? 'G0' : 'G1', 'X#4906', 'Y#4907'];
        if (stmt.z) {
          parts.push('Z#4910');
        }
        if (!stmt.fMax && stmt.feedRate) {
          parts.push(`F${exprToRs274WordValue(stmt.feedRate, digits)}`);
        }
        if (stmt.mCodes) {
          for (const m of stmt.mCodes) {
            if (m === 99) continue;
            if (m === 30 || m === 2) mainEnded = true;
            parts.push(`M${m}`);
          }
        }
        out.push(parts.join(' '));
        if (stmt.mCodes?.includes(99) || stmt.mCode === 99) {
          emitDrillCall(out);
        }
        break;
      }

      case 'polar_arc': {
        const out = targetOut();
        emitCompIfChanged(stmt.comp, out);
        const cmd = stmt.dr === '-' ? 'G2' : 'G3';
        if (stmt.pa) {
          const av = exprToRs274(stmt.pa, digits);
          out.push(stmt.incrementalPa ? `#4905 = [#4904 + ${av}]` : `#4905 = ${av}`);
        } else {
          out.push('#4905 = #4904');
        }
        // Center offset (I, J) from current point (#4906, #4907) to pole (#4901, #4902)
        out.push('#4908 = [#4901 - #4906]');
        out.push('#4909 = [#4902 - #4907]');
        // End point on circle at target angle #4905
        out.push('#4906 = [#4901 + [#4903 * COS[#4905]]]');
        out.push('#4907 = [#4902 + [#4903 * SIN[#4905]]]');
        out.push('#4904 = #4905');
        if (stmt.z) {
          const zv = exprToRs274(stmt.z, digits);
          out.push(stmt.incrementalZ ? `#4910 = [#4910 + ${zv}]` : `#4910 = ${zv}`);
        }

        const parts: string[] = [cmd, 'X#4906', 'Y#4907'];
        if (stmt.z) {
          parts.push('Z#4910');
        }
        parts.push('I#4908', 'J#4909');
        if (stmt.feedRate) {
          parts.push(`F${exprToRs274WordValue(stmt.feedRate, digits)}`);
        }
        if (stmt.mCodes) {
          for (const m of stmt.mCodes) {
            if (m === 99) continue;
            if (m === 30 || m === 2) mainEnded = true;
            parts.push(`M${m}`);
          }
        }
        out.push(parts.join(' '));
        if (stmt.mCodes?.includes(99) || stmt.mCode === 99) {
          emitDrillCall(out);
        }
        break;
      }

      case 'arc': {
        const out = targetOut();
        emitCompIfChanged(stmt.comp, out);
        const cmd = stmt.dr === '-' ? 'G2' : 'G3';
        const iOff = ccX - curX;
        const jOff = ccY - curY;
        const parts = [cmd];
        if (stmt.x) {
          parts.push(`X${exprToRs274WordValue(stmt.x, digits)}`);
          curX = evalHeidenhainExpr(stmt.x, staticQ);
        }
        if (stmt.y) {
          parts.push(`Y${exprToRs274WordValue(stmt.y, digits)}`);
          curY = evalHeidenhainExpr(stmt.y, staticQ);
        }
        if (stmt.z) parts.push(`Z${exprToRs274WordValue(stmt.z, digits)}`);
        parts.push(`I${fmt(iOff)}`, `J${fmt(jOff)}`);
        if (stmt.feedRate) {
          parts.push(`F${exprToRs274WordValue(stmt.feedRate, digits)}`);
        }
        out.push(parts.join(' '));
        if (stmt.mCodes?.includes(99) || stmt.mCode === 99) {
          emitDrillCall(out);
        }
        break;
      }

      case 'arc_radius': {
        const out = targetOut();
        emitCompIfChanged(stmt.comp, out);
        const cmd = stmt.dr === '-' ? 'G2' : 'G3';
        const parts = [cmd];
        if (stmt.x) {
          parts.push(`X${exprToRs274WordValue(stmt.x, digits)}`);
          curX = evalHeidenhainExpr(stmt.x, staticQ);
        }
        if (stmt.y) {
          parts.push(`Y${exprToRs274WordValue(stmt.y, digits)}`);
          curY = evalHeidenhainExpr(stmt.y, staticQ);
        }
        if (stmt.z) parts.push(`Z${exprToRs274WordValue(stmt.z, digits)}`);
        parts.push(`R${exprToRs274WordValue(stmt.radius, digits)}`);
        if (stmt.feedRate) {
          parts.push(`F${exprToRs274WordValue(stmt.feedRate, digits)}`);
        }
        out.push(parts.join(' '));
        break;
      }

      case 'qparam_assign': {
        const out = targetOut();
        out.push(fnAssignToRs274(stmt, digits));
        // Best-effort static tracking for cycle params / CC offsets
        const v1 = evalHeidenhainExpr(stmt.expr, staticQ);
        const v2 = stmt.operand2 ? evalHeidenhainExpr(stmt.operand2, staticQ) : 0;
        if (stmt.op === 'assign') staticQ[stmt.target] = v1;
        else if (stmt.op === 'add') staticQ[stmt.target] = v1 + v2;
        else if (stmt.op === 'sub') staticQ[stmt.target] = v1 - v2;
        else if (stmt.op === 'mul') staticQ[stmt.target] = v1 * v2;
        else if (stmt.op === 'div') staticQ[stmt.target] = Math.abs(v2) > 1e-9 ? v1 / v2 : 0;
        else if (stmt.op === 'sqrt') staticQ[stmt.target] = v1 >= 0 ? Math.sqrt(v1) : 0;
        else if (stmt.op === 'sin') staticQ[stmt.target] = Math.sin((v1 * Math.PI) / 180);
        else if (stmt.op === 'cos') staticQ[stmt.target] = Math.cos((v1 * Math.PI) / 180);
        else if (stmt.op === 'len') staticQ[stmt.target] = Math.hypot(v1, v2);
        break;
      }

      case 'label_def': {
        if (stmt.label === 0) {
          if (inSubroutine) {
            subLines.push('M99');
            inSubroutine = false;
          }
        } else {
          inSubroutine = true;
          subLines.push(`O${stmt.label}`);
        }
        break;
      }

      case 'call_label': {
        const out = targetOut();
        if (stmt.repeat) {
          if (stmt.repeat.type === 'number') {
            const loops = Math.max(1, Math.floor(stmt.repeat.value) + 1);
            out.push(`M98 P${stmt.label} L${loops}`);
          } else {
            out.push(`M98 P${stmt.label} L[${exprToRs274(stmt.repeat, digits)} + 1]`);
          }
        } else {
          out.push(`M98 P${stmt.label}`);
        }
        break;
      }

      case 'cycl_def': {
        if (stmt.cycleNumber === 1 || stmt.cycleNumber === 200) {
          activeDrillCycle = stmt;
        }
        break;
      }

      case 'cycl_call': {
        const out = targetOut();
        emitDrillCall(out);
        break;
      }

      case 'm_code': {
        const out = targetOut();
        if (stmt.code === 99) {
          emitDrillCall(out);
        } else {
          if (!inSubroutine && (stmt.code === 30 || stmt.code === 2)) {
            mainEnded = true;
          }
          out.push(`M${stmt.code}`);
        }
        break;
      }

      default:
        break;
    }
  }

  if (!mainEnded) {
    mainLines.push('M30');
  }

  const allLines = subLines.length > 0 ? [...mainLines, '', ...subLines] : mainLines;
  return allLines.join('\n') + '\n';
}

/**
 * Transpiles a parsed Heidenhain Klartext AST into KMotionX-compatible RS274 G-code.
 *
 * In `'structured'` mode (default), preserves native RS274 constructs (`O<n>`, `M98`,
 * `M99`, `#<n>`, `G41`/`G42`/`G40`, `G81`/`G83`/`G80`). If the program uses constructs
 * that KMotionX `rs274ngc` lacks natively, it automatically falls back to `'flattened'`
 * mode with explanatory warnings.
 */
export function transpileHeidenhainToGcode(
  program: HeidenhainProgram,
  options: HeidenhainTranspileOptions = {},
): HeidenhainTranspileResult {
  const requestedMode: HeidenhainTranspileMode = options.mode ?? 'structured';
  const digits = options.fractionalDigits ?? 3;
  const warnings: string[] = [...program.warnings];

  if (requestedMode === 'structured') {
    const blockers = detectStructuredBlockers(program);
    if (blockers.length === 0) {
      const gcode = emitStructuredGcode(program, digits);
      return {
        gcode,
        requestedMode,
        usedMode: 'structured',
        fellBack: false,
        warnings,
      };
    }

    // Automatic fallback to flattened mode
    warnings.push(
      `Auto-fallback to flattened G-code mode: ${blockers.join('; ')}`,
    );
    const evalRes = evaluateHeidenhainToIgm(program, options.evalOptions);
    for (const w of evalRes.warnings) {
      if (!warnings.includes(w)) warnings.push(w);
    }
    const gcode = emitFlattenedGcode(program, evalRes.document, digits);
    return {
      gcode,
      requestedMode,
      usedMode: 'flattened',
      fellBack: true,
      warnings,
    };
  }

  // Explicitly requested flattened mode
  const evalRes = evaluateHeidenhainToIgm(program, options.evalOptions);
  for (const w of evalRes.warnings) {
    if (!warnings.includes(w)) warnings.push(w);
  }
  const gcode = emitFlattenedGcode(program, evalRes.document, digits);
  return {
    gcode,
    requestedMode,
    usedMode: 'flattened',
    fellBack: false,
    warnings,
  };
}

/**
 * Convenience helper: parses Heidenhain Klartext source text and evaluates it directly
 * into a canonical (mm) IGM document.
 */
export function parseHeidenhainToIgm(
  source: string,
  options?: HeidenhainEvalOptions,
): HeidenhainEvalResult {
  const ast = parseHeidenhainToAst(source);
  return evaluateHeidenhainToIgm(ast, options);
}
