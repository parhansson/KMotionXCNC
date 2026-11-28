import {
  type ArcSegment,
  type IgmDocument,
  type IgmSegment,
  type LineSegment,
  type SourceRef,
  type StockBounds,
  type Vec8,
  cloneVec8,
  computeBounds,
  createEmptyDocument,
} from '@kmxcnc/igm';
import type {
  ArcDirection,
  CallLabelNode,
  CyclDefNode,
  HeidenhainExpr,
  HeidenhainProgram,
  HeidenhainStatement,
  QParamAssignNode,
} from './ast';

const MM_PER_INCH = 25.4;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const EPS = 1e-9;

export interface HeidenhainEvalOptions {
  /** Hard upper bound on executed instructions to guard against infinite loops. Default: 10_000. */
  maxIterations?: number;
  /** Hard upper bound on nested CALL LBL depth. Default: 32. */
  maxCallDepth?: number;
  /** Default cutting feed rate in mm/min when not specified. Default: 500. */
  defaultFeedRate?: number;
  /** Assumed tool diameter in mm for pocket cycle stepover calculations. Default: 6. */
  toolDiameter?: number;
  /** Target IGM layer id. Default: 'heidenhain'. */
  layerId?: string;
}

export interface HeidenhainEvalResult {
  document: IgmDocument;
  warnings: string[];
  qParams: Record<number, number>;
  stockBounds?: StockBounds;
  iterations: number;
  truncated: boolean;
}

interface CallFrame {
  returnIp: number;
  labelIp: number;
  remainingRepeats: number;
  callLine: number;
}

interface CoordTransform {
  datumX: number;
  datumY: number;
  datumZ: number;
  mirrorX: boolean;
  mirrorY: boolean;
  rotationDeg: number;
}

export function evalHeidenhainExpr(
  expr: HeidenhainExpr,
  qParams: Record<number, number>,
): number {
  switch (expr.type) {
    case 'number':
      return expr.value;
    case 'qparam':
      return qParams[expr.index] ?? 0;
    case 'unary': {
      const v = evalHeidenhainExpr(expr.operand, qParams);
      return expr.op === '-' ? -v : v;
    }
    case 'binary': {
      const l = evalHeidenhainExpr(expr.left, qParams);
      const r = evalHeidenhainExpr(expr.right, qParams);
      switch (expr.op) {
        case '+':
          return l + r;
        case '-':
          return l - r;
        case '*':
          return l * r;
        case '/':
          return Math.abs(r) < EPS ? 0 : l / r;
      }
    }
  }
}

function transformPoint(p: Vec8, tf: CoordTransform, unitScale: number): Vec8 {
  const mx = tf.mirrorX ? -p.x : p.x;
  const my = tf.mirrorY ? -p.y : p.y;
  const rad = tf.rotationDeg * DEG_TO_RAD;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rx = mx * cos - my * sin;
  const ry = mx * sin + my * cos;

  const out: Vec8 = {
    x: (rx + tf.datumX) * unitScale,
    y: (ry + tf.datumY) * unitScale,
    z: (p.z + tf.datumZ) * unitScale,
  };
  if (p.a !== undefined) out.a = p.a;
  if (p.b !== undefined) out.b = p.b;
  if (p.c !== undefined) out.c = p.c;
  return out;
}

function transformXY(
  x: number,
  y: number,
  tf: CoordTransform,
  unitScale: number,
): { x: number; y: number } {
  const mx = tf.mirrorX ? -x : x;
  const my = tf.mirrorY ? -y : y;
  const rad = tf.rotationDeg * DEG_TO_RAD;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rx = mx * cos - my * sin;
  const ry = mx * sin + my * cos;
  return {
    x: (rx + tf.datumX) * unitScale,
    y: (ry + tf.datumY) * unitScale,
  };
}

function isMirroredOdd(tf: CoordTransform): boolean {
  return tf.mirrorX !== tf.mirrorY;
}

function labelKey(label: number | string): string {
  return typeof label === 'number' ? `n:${label}` : `s:${label}`;
}

/**
 * Determines whether a label definition at `labelIp` has a corresponding `LBL 0`
 * subroutine terminator before the end of the program (without crossing another
 * non-zero label definition that belongs to a different subroutine).
 */
function hasSubroutineEnd(statements: HeidenhainStatement[], labelIp: number): boolean {
  for (let i = labelIp + 1; i < statements.length; i++) {
    const s = statements[i]!;
    if (s.type === 'label_def' && s.label === 0) {
      return true;
    }
    if (s.type === 'end_pgm') {
      return false;
    }
  }
  return false;
}

function computeArcCenterFromRadius(
  sx: number,
  sy: number,
  ex: number,
  ey: number,
  signedRadius: number,
  dr: ArcDirection,
): { cx: number; cy: number; clamped: boolean } {
  const dx = ex - sx;
  const dy = ey - sy;
  const dist = Math.hypot(dx, dy);
  if (dist < EPS) {
    return { cx: sx, cy: sy, clamped: true };
  }
  const halfDist = dist / 2;
  let r = Math.abs(signedRadius);
  let clamped = false;
  if (r < halfDist) {
    r = halfDist;
    clamped = true;
  }
  const h = Math.sqrt(Math.max(0, r * r - halfDist * halfDist));
  const mx = (sx + ex) / 2;
  const my = (sy + ey) / 2;
  // Left unit normal of chord
  const nx = -dy / dist;
  const ny = dx / dist;
  // DR+ (CCW) minor (r >= 0) -> center on left (+1); DR- (CW) minor -> center on right (-1)
  const sign = (dr === '+' ? 1 : -1) * (signedRadius >= 0 ? 1 : -1);
  return {
    cx: mx + sign * nx * h,
    cy: my + sign * ny * h,
    clamped,
  };
}

/**
 * Evaluates a Heidenhain Klartext AST into a flat canonical (mm) IgmDocument.
 */
export function evaluateHeidenhainToIgm(
  program: HeidenhainProgram,
  options: HeidenhainEvalOptions = {},
): HeidenhainEvalResult {
  const maxIterations = options.maxIterations ?? 10_000;
  const maxCallDepth = options.maxCallDepth ?? 32;
  const defaultFeedRate = options.defaultFeedRate ?? 500;
  const toolDiameterMm = options.toolDiameter ?? 6;
  const layerId = options.layerId ?? 'heidenhain';

  const unitScale = program.units === 'in' ? MM_PER_INCH : 1;
  const toolDiameterProg = toolDiameterMm / unitScale;

  const warnings: string[] = [...program.warnings];
  const segments: IgmSegment[] = [];
  const qParams: Record<number, number> = {};

  // Index label definitions (excluding LBL 0 which marks subroutine return)
  const labelMap = new Map<string, number>();
  for (let i = 0; i < program.statements.length; i++) {
    const stmt = program.statements[i]!;
    if (stmt.type === 'label_def' && stmt.label !== 0) {
      labelMap.set(labelKey(stmt.label), i);
    }
  }

  // Machine/program modal state (in program units)
  const pos: Vec8 = { x: 0, y: 0, z: 0 };
  const cc = { x: 0, y: 0 };
  let feedRateProg = defaultFeedRate / unitScale;
  const tf: CoordTransform = {
    datumX: 0,
    datumY: 0,
    datumZ: 0,
    mirrorX: false,
    mirrorY: false,
    rotationDeg: 0,
  };

  let blkP1: { x: number; y: number; z: number } | undefined;
  let blkP2: { x: number; y: number; z: number } | undefined;

  let activeCycle: CyclDefNode | undefined;
  let activeDrillCycle: CyclDefNode | undefined;
  let pendingAutoCycle220 = false;

  const callStack: CallFrame[] = [];
  // Tracks remaining repeat counts for backward section repeats (LBL n ... CALL LBL n REP m)
  const sectionLoopRemaining = new Map<number, number>();

  let ip = 0;
  let iterations = 0;
  let truncated = false;

  const currentSourceRef = (line: number): SourceRef => {
    const stackLines = callStack.map((f) => f.callLine);
    return {
      kind: 'heidenhain',
      line,
      ...(stackLines.length > 0 ? { callStack: stackLines } : {}),
    };
  };

  const emitLine = (
    from: Vec8,
    to: Vec8,
    kind: 'rapid' | 'cut',
    line: number,
    feedProg?: number,
  ): void => {
    const startMm = transformPoint(from, tf, unitScale);
    const endMm = transformPoint(to, tf, unitScale);
    const dist = Math.hypot(
      endMm.x - startMm.x,
      endMm.y - startMm.y,
      endMm.z - startMm.z,
    );
    const rotChanged =
      startMm.a !== endMm.a || startMm.b !== endMm.b || startMm.c !== endMm.c;
    if (dist < EPS && !rotChanged) return;

    const seg: LineSegment = {
      type: 'line',
      kind,
      start: startMm,
      end: endMm,
      layer: layerId,
      sourceRef: currentSourceRef(line),
      ...(kind === 'cut' ? { feedRate: (feedProg ?? feedRateProg) * unitScale } : {}),
    };
    segments.push(seg);
  };

  const emitArc = (
    from: Vec8,
    to: Vec8,
    centerXProg: number,
    centerYProg: number,
    dr: ArcDirection,
    line: number,
    feedProg?: number,
  ): void => {
    const startMm = transformPoint(from, tf, unitScale);
    const endMm = transformPoint(to, tf, unitScale);
    const centerMm = transformXY(centerXProg, centerYProg, tf, unitScale);
    let clockwise = dr === '-';
    if (isMirroredOdd(tf)) {
      clockwise = !clockwise;
    }

    const seg: ArcSegment = {
      type: 'arc',
      kind: 'cut',
      start: startMm,
      end: endMm,
      center: { x: centerMm.x, y: centerMm.y },
      clockwise,
      plane: 'G17',
      feedRate: (feedProg ?? feedRateProg) * unitScale,
      layer: layerId,
      sourceRef: currentSourceRef(line),
    };
    segments.push(seg);
  };

  const moveLinear = (target: Vec8, isRapid: boolean, line: number, feedProg?: number): void => {
    const prev = cloneVec8(pos);
    pos.x = target.x;
    pos.y = target.y;
    pos.z = target.z;
    if (target.a !== undefined) pos.a = target.a;
    if (target.b !== undefined) pos.b = target.b;
    if (target.c !== undefined) pos.c = target.c;
    emitLine(prev, pos, isRapid ? 'rapid' : 'cut', line, feedProg);
  };

  const getCycleParam = (cycle: CyclDefNode, qNum: number, fallback: number): number => {
    const expr = cycle.params[qNum];
    if (expr) return evalHeidenhainExpr(expr, qParams);
    return fallback;
  };

  const executeDrillCycle = (cycle: CyclDefNode, line: number): void => {
    const setupClearance = Math.abs(getCycleParam(cycle, 200, 2 / unitScale));
    const depthRaw = getCycleParam(cycle, 201, -10 / unitScale);
    const depth = depthRaw <= 0 ? depthRaw : -depthRaw;
    const peckRaw = Math.abs(getCycleParam(cycle, 202, 0));
    const surfaceZ = getCycleParam(cycle, 203, 0);
    const secondClearance = Math.abs(getCycleParam(cycle, 204, Math.max(setupClearance, 10 / unitScale)));
    const plungeFeed = Math.abs(getCycleParam(cycle, 206, feedRateProg)) || feedRateProg;

    const clearanceZ = surfaceZ + setupClearance;
    const retractZ = surfaceZ + Math.max(setupClearance, secondClearance);
    const finalZ = surfaceZ + depth;

    // Rapid to setup clearance
    moveLinear({ ...pos, z: clearanceZ }, true, line);

    if (peckRaw > EPS && peckRaw < Math.abs(depth) - EPS) {
      let curDepth = 0;
      const totalDepth = Math.abs(depth);
      let pecks = 0;
      while (curDepth < totalDepth - EPS && pecks < 1000) {
        pecks++;
        curDepth = Math.min(totalDepth, curDepth + peckRaw);
        const targetZ = surfaceZ - curDepth;
        moveLinear({ ...pos, z: targetZ }, false, line, plungeFeed);
        moveLinear({ ...pos, z: clearanceZ }, true, line);
      }
    } else {
      moveLinear({ ...pos, z: finalZ }, false, line, plungeFeed);
      moveLinear({ ...pos, z: clearanceZ }, true, line);
    }

    if (Math.abs(retractZ - pos.z) > EPS) {
      moveLinear({ ...pos, z: retractZ }, true, line);
    }
  };

  const executeBoltCircleCycle = (cycle: CyclDefNode, line: number): void => {
    const cx = getCycleParam(cycle, 216, pos.x);
    const cy = getCycleParam(cycle, 217, pos.y);
    const diameter = Math.abs(getCycleParam(cycle, 222, 50 / unitScale));
    const startAngle = getCycleParam(cycle, 224, 0);
    const holeCount = Math.max(1, Math.min(500, Math.round(getCycleParam(cycle, 241, 4))));
    const stepAngleParam = getCycleParam(cycle, 225, 0);
    const stepAngle = Math.abs(stepAngleParam) > EPS ? stepAngleParam : 360 / holeCount;
    const radius = diameter / 2;

    const drill = activeDrillCycle;
    const safeZ = drill
      ? getCycleParam(drill, 203, 0) +
        Math.max(
          Math.abs(getCycleParam(drill, 200, 2 / unitScale)),
          Math.abs(getCycleParam(drill, 204, 10 / unitScale)),
        )
      : Math.max(pos.z, 5 / unitScale);

    for (let i = 0; i < holeCount; i++) {
      const angleRad = (startAngle + i * stepAngle) * DEG_TO_RAD;
      const hx = cx + radius * Math.cos(angleRad);
      const hy = cy + radius * Math.sin(angleRad);

      if (pos.z < safeZ - EPS) {
        moveLinear({ ...pos, z: safeZ }, true, line);
      }
      moveLinear({ ...pos, x: hx, y: hy }, true, line);

      if (drill) {
        executeDrillCycle(drill, line);
      } else {
        // Fallback single plunge if no drill cycle was defined prior to CYCL DEF 220
        const defaultDepth = -5 / unitScale;
        moveLinear({ ...pos, z: defaultDepth }, false, line, feedRateProg);
        moveLinear({ ...pos, z: safeZ }, true, line);
      }
    }
  };

  const executeRectPocketCycle = (cycle: CyclDefNode, line: number): void => {
    const sideX = Math.abs(getCycleParam(cycle, 218, 20 / unitScale));
    const sideY = Math.abs(getCycleParam(cycle, 219, 20 / unitScale));
    const setupClearance = Math.abs(getCycleParam(cycle, 200, 2 / unitScale));
    const depthRaw = getCycleParam(cycle, 201, -5 / unitScale);
    const totalDepth = Math.abs(depthRaw);
    const plungeStep = Math.abs(getCycleParam(cycle, 202, totalDepth)) || totalDepth;
    const surfaceZ = getCycleParam(cycle, 203, 0);
    const secondClearance = Math.abs(getCycleParam(cycle, 204, Math.max(setupClearance, 10 / unitScale)));
    const plungeFeed = Math.abs(getCycleParam(cycle, 206, feedRateProg * 0.5)) || feedRateProg;
    const millFeed = Math.abs(getCycleParam(cycle, 207, feedRateProg)) || feedRateProg;
    const overlap = Math.min(0.95, Math.max(0.1, getCycleParam(cycle, 370, 0.5)));

    const cx = pos.x;
    const cy = pos.y;
    const toolR = Math.min(toolDiameterProg / 2, Math.min(sideX, sideY) / 4);
    const maxHx = Math.max(EPS, sideX / 2 - toolR);
    const maxHy = Math.max(EPS, sideY / 2 - toolR);
    const stepOver = Math.max(toolDiameterProg * overlap, Math.min(maxHx, maxHy) / 20, EPS);

    const clearanceZ = surfaceZ + setupClearance;
    const retractZ = surfaceZ + Math.max(setupClearance, secondClearance);

    const zPasses = Math.max(1, Math.min(200, Math.ceil(totalDepth / plungeStep)));

    moveLinear({ ...pos, z: clearanceZ }, true, line);

    for (let pz = 1; pz <= zPasses; pz++) {
      const zLevel = surfaceZ - Math.min(totalDepth, (totalDepth * pz) / zPasses);
      // Rapid to pocket center at clearance, plunge to Z level
      moveLinear({ ...pos, x: cx, y: cy }, true, line);
      moveLinear({ ...pos, z: zLevel }, false, line, plungeFeed);

      // Concentric rectangular rings from center outward
      const ringCount = Math.max(1, Math.min(200, Math.ceil(Math.max(maxHx, maxHy) / stepOver)));
      for (let r = 1; r <= ringCount; r++) {
        const frac = r / ringCount;
        const hx = maxHx * frac;
        const hy = maxHy * frac;

        moveLinear({ ...pos, x: cx + hx, y: cy - hy }, false, line, millFeed);
        moveLinear({ ...pos, x: cx + hx, y: cy + hy }, false, line, millFeed);
        moveLinear({ ...pos, x: cx - hx, y: cy + hy }, false, line, millFeed);
        moveLinear({ ...pos, x: cx - hx, y: cy - hy }, false, line, millFeed);
        moveLinear({ ...pos, x: cx + hx, y: cy - hy }, false, line, millFeed);
      }

      moveLinear({ ...pos, z: clearanceZ }, true, line);
    }

    moveLinear({ ...pos, x: cx, y: cy, z: retractZ }, true, line);
  };

  const executeCircularPocketCycle = (cycle: CyclDefNode, line: number): void => {
    const diameter = Math.abs(getCycleParam(cycle, 223, 20 / unitScale));
    const setupClearance = Math.abs(getCycleParam(cycle, 200, 2 / unitScale));
    const depthRaw = getCycleParam(cycle, 201, -5 / unitScale);
    const totalDepth = Math.abs(depthRaw);
    const plungeStep = Math.abs(getCycleParam(cycle, 202, totalDepth)) || totalDepth;
    const surfaceZ = getCycleParam(cycle, 203, 0);
    const secondClearance = Math.abs(getCycleParam(cycle, 204, Math.max(setupClearance, 10 / unitScale)));
    const plungeFeed = Math.abs(getCycleParam(cycle, 206, feedRateProg * 0.5)) || feedRateProg;
    const millFeed = Math.abs(getCycleParam(cycle, 207, feedRateProg)) || feedRateProg;
    const overlap = Math.min(0.95, Math.max(0.1, getCycleParam(cycle, 370, 0.5)));

    const cx = pos.x;
    const cy = pos.y;
    const toolR = Math.min(toolDiameterProg / 2, diameter / 4);
    const maxR = Math.max(EPS, diameter / 2 - toolR);
    const stepOver = Math.max(toolDiameterProg * overlap, maxR / 20, EPS);

    const clearanceZ = surfaceZ + setupClearance;
    const retractZ = surfaceZ + Math.max(setupClearance, secondClearance);
    const zPasses = Math.max(1, Math.min(200, Math.ceil(totalDepth / plungeStep)));

    moveLinear({ ...pos, z: clearanceZ }, true, line);

    for (let pz = 1; pz <= zPasses; pz++) {
      const zLevel = surfaceZ - Math.min(totalDepth, (totalDepth * pz) / zPasses);
      moveLinear({ ...pos, x: cx, y: cy }, true, line);
      moveLinear({ ...pos, z: zLevel }, false, line, plungeFeed);

      const ringCount = Math.max(1, Math.min(200, Math.ceil(maxR / stepOver)));
      for (let r = 1; r <= ringCount; r++) {
        const rad = (maxR * r) / ringCount;
        // Lead out to +X at radius
        moveLinear({ ...pos, x: cx + rad, y: cy }, false, line, millFeed);
        // Full 360-degree CCW circle around (cx, cy)
        const startPt = cloneVec8(pos);
        emitArc(startPt, startPt, cx, cy, '+', line, millFeed);
      }

      moveLinear({ ...pos, z: clearanceZ }, true, line);
    }

    moveLinear({ ...pos, x: cx, y: cy, z: retractZ }, true, line);
  };

  const executeActiveCycle = (line: number): void => {
    if (!activeCycle) {
      warnings.push(`Line ${line}: CYCL CALL invoked with no active CYCL DEF`);
      return;
    }
    const cNum = activeCycle.cycleNumber;
    if (cNum === 1 || cNum === 200) {
      executeDrillCycle(activeCycle, line);
    } else if (cNum === 220) {
      pendingAutoCycle220 = false;
      executeBoltCircleCycle(activeCycle, line);
    } else if (cNum === 251 || cNum === 4) {
      executeRectPocketCycle(activeCycle, line);
    } else if (cNum === 252 || cNum === 5) {
      executeCircularPocketCycle(activeCycle, line);
    } else {
      warnings.push(`Line ${line}: unsupported cycle CYCL DEF ${cNum}`);
    }
  };

  const flushPendingCycle220 = (): void => {
    if (pendingAutoCycle220 && activeCycle && activeCycle.cycleNumber === 220) {
      pendingAutoCycle220 = false;
      executeBoltCircleCycle(activeCycle, activeCycle.line);
    }
  };

  const evalQParamAssign = (stmt: QParamAssignNode): void => {
    const v1 = evalHeidenhainExpr(stmt.expr, qParams);
    const v2 = stmt.operand2 ? evalHeidenhainExpr(stmt.operand2, qParams) : 0;
    let result = v1;

    switch (stmt.op) {
      case 'assign':
        result = v1;
        break;
      case 'add':
        result = v1 + v2;
        break;
      case 'sub':
        result = v1 - v2;
        break;
      case 'mul':
        result = v1 * v2;
        break;
      case 'div':
        if (Math.abs(v2) < EPS) {
          warnings.push(`Line ${stmt.line}: division by zero in FN 4 / Q${stmt.target}`);
          result = 0;
        } else {
          result = v1 / v2;
        }
        break;
      case 'sqrt':
        result = v1 < 0 ? 0 : Math.sqrt(v1);
        break;
      case 'sin':
        result = Math.sin(v1 * DEG_TO_RAD);
        break;
      case 'cos':
        result = Math.cos(v1 * DEG_TO_RAD);
        break;
      case 'len':
        result = Math.hypot(v1, v2);
        break;
    }

    qParams[stmt.target] = result;
  };

  // Main execution loop
  while (ip < program.statements.length) {
    iterations++;
    if (iterations > maxIterations) {
      warnings.push(
        `Execution halted: exceeded maxIterations (${maxIterations}) — possible infinite loop`,
      );
      truncated = true;
      break;
    }

    const stmt = program.statements[ip]!;

    // If a CYCL DEF 220 wasn't followed by an explicit CYCL CALL, run it before the next non-CALL statement
    if (pendingAutoCycle220 && stmt.type !== 'cycl_call') {
      flushPendingCycle220();
    }

    switch (stmt.type) {
      case 'begin_pgm':
        ip++;
        break;

      case 'end_pgm':
        flushPendingCycle220();
        ip = program.statements.length;
        break;

      case 'blk_form': {
        const pt = {
          x: evalHeidenhainExpr(stmt.x, qParams),
          y: evalHeidenhainExpr(stmt.y, qParams),
          z: evalHeidenhainExpr(stmt.z, qParams),
        };
        if (stmt.point === 1) blkP1 = pt;
        else blkP2 = pt;
        ip++;
        break;
      }

      case 'tool_call': {
        if (stmt.feedRate) {
          const f = evalHeidenhainExpr(stmt.feedRate, qParams);
          if (f > 0) feedRateProg = f;
        }
        ip++;
        break;
      }

      case 'linear': {
        if (stmt.feedRate) {
          const f = evalHeidenhainExpr(stmt.feedRate, qParams);
          if (f > 0) feedRateProg = f;
        }
        const target = cloneVec8(pos);
        if (stmt.x) {
          const v = evalHeidenhainExpr(stmt.x, qParams);
          target.x = stmt.incremental.x ? pos.x + v : v;
        }
        if (stmt.y) {
          const v = evalHeidenhainExpr(stmt.y, qParams);
          target.y = stmt.incremental.y ? pos.y + v : v;
        }
        if (stmt.z) {
          const v = evalHeidenhainExpr(stmt.z, qParams);
          target.z = stmt.incremental.z ? pos.z + v : v;
        }
        if (stmt.a) {
          const v = evalHeidenhainExpr(stmt.a, qParams);
          target.a = stmt.incremental.a ? (pos.a ?? 0) + v : v;
        }
        if (stmt.b) {
          const v = evalHeidenhainExpr(stmt.b, qParams);
          target.b = stmt.incremental.b ? (pos.b ?? 0) + v : v;
        }
        if (stmt.c) {
          const v = evalHeidenhainExpr(stmt.c, qParams);
          target.c = stmt.incremental.c ? (pos.c ?? 0) + v : v;
        }

        moveLinear(target, Boolean(stmt.fMax), stmt.line);

        if (stmt.mCodes?.includes(99) || stmt.mCode === 99) {
          executeActiveCycle(stmt.line);
        }
        if (stmt.mCodes?.includes(30) || stmt.mCodes?.includes(2)) {
          ip = program.statements.length;
        } else {
          ip++;
        }
        break;
      }

      case 'circle_center': {
        if (stmt.x) {
          const v = evalHeidenhainExpr(stmt.x, qParams);
          cc.x = stmt.incremental.x ? pos.x + v : v;
        } else {
          cc.x = pos.x;
        }
        if (stmt.y) {
          const v = evalHeidenhainExpr(stmt.y, qParams);
          cc.y = stmt.incremental.y ? pos.y + v : v;
        } else {
          cc.y = pos.y;
        }
        ip++;
        break;
      }

      case 'arc': {
        if (stmt.feedRate) {
          const f = evalHeidenhainExpr(stmt.feedRate, qParams);
          if (f > 0) feedRateProg = f;
        }
        const prev = cloneVec8(pos);
        if (stmt.x) {
          const v = evalHeidenhainExpr(stmt.x, qParams);
          pos.x = stmt.incremental.x ? prev.x + v : v;
        }
        if (stmt.y) {
          const v = evalHeidenhainExpr(stmt.y, qParams);
          pos.y = stmt.incremental.y ? prev.y + v : v;
        }
        if (stmt.z) {
          const v = evalHeidenhainExpr(stmt.z, qParams);
          pos.z = stmt.incremental.z ? prev.z + v : v;
        }
        emitArc(prev, pos, cc.x, cc.y, stmt.dr, stmt.line);
        if (stmt.mCodes?.includes(99) || stmt.mCode === 99) {
          executeActiveCycle(stmt.line);
        }
        ip++;
        break;
      }

      case 'arc_radius': {
        if (stmt.feedRate) {
          const f = evalHeidenhainExpr(stmt.feedRate, qParams);
          if (f > 0) feedRateProg = f;
        }
        const prev = cloneVec8(pos);
        if (stmt.x) {
          const v = evalHeidenhainExpr(stmt.x, qParams);
          pos.x = stmt.incremental.x ? prev.x + v : v;
        }
        if (stmt.y) {
          const v = evalHeidenhainExpr(stmt.y, qParams);
          pos.y = stmt.incremental.y ? prev.y + v : v;
        }
        if (stmt.z) {
          const v = evalHeidenhainExpr(stmt.z, qParams);
          pos.z = stmt.incremental.z ? prev.z + v : v;
        }
        const r = evalHeidenhainExpr(stmt.radius, qParams);
        const { cx, cy, clamped } = computeArcCenterFromRadius(
          prev.x,
          prev.y,
          pos.x,
          pos.y,
          r,
          stmt.dr,
        );
        if (clamped) {
          warnings.push(`Line ${stmt.line}: CR radius ${r} clamped to fit chord`);
        }
        emitArc(prev, pos, cx, cy, stmt.dr, stmt.line);
        if (stmt.mCodes?.includes(99) || stmt.mCode === 99) {
          executeActiveCycle(stmt.line);
        }
        ip++;
        break;
      }

      case 'polar_linear': {
        if (stmt.feedRate) {
          const f = evalHeidenhainExpr(stmt.feedRate, qParams);
          if (f > 0) feedRateProg = f;
        }
        const curR = Math.hypot(pos.x - cc.x, pos.y - cc.y);
        const curA = Math.atan2(pos.y - cc.y, pos.x - cc.x) * RAD_TO_DEG;

        const targetR = stmt.pr
          ? stmt.incrementalPr
            ? curR + evalHeidenhainExpr(stmt.pr, qParams)
            : evalHeidenhainExpr(stmt.pr, qParams)
          : curR;
        const targetA = stmt.pa
          ? stmt.incrementalPa
            ? curA + evalHeidenhainExpr(stmt.pa, qParams)
            : evalHeidenhainExpr(stmt.pa, qParams)
          : curA;

        const target = cloneVec8(pos);
        target.x = cc.x + targetR * Math.cos(targetA * DEG_TO_RAD);
        target.y = cc.y + targetR * Math.sin(targetA * DEG_TO_RAD);
        if (stmt.z) {
          const v = evalHeidenhainExpr(stmt.z, qParams);
          target.z = stmt.incrementalZ ? pos.z + v : v;
        }

        moveLinear(target, Boolean(stmt.fMax), stmt.line);
        if (stmt.mCodes?.includes(99) || stmt.mCode === 99) {
          executeActiveCycle(stmt.line);
        }
        ip++;
        break;
      }

      case 'polar_arc': {
        if (stmt.feedRate) {
          const f = evalHeidenhainExpr(stmt.feedRate, qParams);
          if (f > 0) feedRateProg = f;
        }
        const prev = cloneVec8(pos);
        const r = Math.hypot(prev.x - cc.x, prev.y - cc.y);
        const startA = Math.atan2(prev.y - cc.y, prev.x - cc.x) * RAD_TO_DEG;
        const paVal = evalHeidenhainExpr(stmt.pa, qParams);
        const endZ = stmt.z
          ? stmt.incrementalZ
            ? prev.z + evalHeidenhainExpr(stmt.z, qParams)
            : evalHeidenhainExpr(stmt.z, qParams)
          : prev.z;

        if (stmt.incrementalPa && Math.abs(paVal) >= 360 - 1e-6) {
          // Handle full circle(s) (possibly helical)
          const fullTurns = Math.floor(Math.abs(paVal) / 360 + 1e-6);
          const remDeg = paVal - Math.sign(paVal) * fullTurns * 360;
          const totalSweep = Math.abs(paVal);
          let curZ = prev.z;
          for (let t = 0; t < fullTurns; t++) {
            const nextZ = curZ + ((endZ - prev.z) * 360) / totalSweep;
            const fromPt = { ...prev, z: curZ };
            const toPt = { ...prev, z: nextZ };
            emitArc(fromPt, toPt, cc.x, cc.y, stmt.dr, stmt.line);
            curZ = nextZ;
          }
          if (Math.abs(remDeg) > 1e-6) {
            const endA = startA + remDeg;
            const fromPt = { ...prev, z: curZ };
            pos.x = cc.x + r * Math.cos(endA * DEG_TO_RAD);
            pos.y = cc.y + r * Math.sin(endA * DEG_TO_RAD);
            pos.z = endZ;
            emitArc(fromPt, pos, cc.x, cc.y, stmt.dr, stmt.line);
          } else {
            pos.z = endZ;
          }
        } else {
          const endA = stmt.incrementalPa ? startA + paVal : paVal;
          pos.x = cc.x + r * Math.cos(endA * DEG_TO_RAD);
          pos.y = cc.y + r * Math.sin(endA * DEG_TO_RAD);
          pos.z = endZ;
          emitArc(prev, pos, cc.x, cc.y, stmt.dr, stmt.line);
        }

        if (stmt.mCodes?.includes(99) || stmt.mCode === 99) {
          executeActiveCycle(stmt.line);
        }
        ip++;
        break;
      }

      case 'qparam_assign':
        evalQParamAssign(stmt);
        ip++;
        break;

      case 'fn_goto': {
        const l = evalHeidenhainExpr(stmt.left, qParams);
        const r = evalHeidenhainExpr(stmt.right, qParams);
        let cond = false;
        switch (stmt.op) {
          case 'eq':
            cond = Math.abs(l - r) < 1e-9;
            break;
          case 'ne':
            cond = Math.abs(l - r) >= 1e-9;
            break;
          case 'gt':
            cond = l > r + 1e-9;
            break;
          case 'lt':
            cond = l < r - 1e-9;
            break;
        }
        if (cond) {
          const targetIp = labelMap.get(labelKey(stmt.targetLabel));
          if (targetIp === undefined) {
            warnings.push(`Line ${stmt.line}: GOTO LBL ${stmt.targetLabel} not found`);
            ip++;
          } else {
            ip = targetIp + 1;
          }
        } else {
          ip++;
        }
        break;
      }

      case 'label_def': {
        if (stmt.label === 0) {
          // End of subroutine
          const frame = callStack[callStack.length - 1];
          if (frame) {
            if (frame.remainingRepeats > 0) {
              frame.remainingRepeats--;
              ip = frame.labelIp + 1;
            } else {
              callStack.pop();
              ip = frame.returnIp;
            }
          } else {
            ip++;
          }
        } else {
          ip++;
        }
        break;
      }

      case 'call_label': {
        const callStmt: CallLabelNode = stmt;
        const targetIp = labelMap.get(labelKey(callStmt.label));
        if (targetIp === undefined) {
          warnings.push(`Line ${callStmt.line}: CALL LBL ${callStmt.label} not found`);
          ip++;
          break;
        }

        const repCount = callStmt.repeat
          ? Math.max(0, Math.floor(evalHeidenhainExpr(callStmt.repeat, qParams)))
          : 0;

        // Check if this is a backward program-section repeat (LBL n ... CALL LBL n REP m without LBL 0)
        const isBackwardSection =
          targetIp < ip && !hasSubroutineEnd(program.statements.slice(0, ip), targetIp);

        if (isBackwardSection) {
          let rem = sectionLoopRemaining.get(ip);
          if (rem === undefined) {
            rem = repCount;
          }
          if (rem > 0) {
            sectionLoopRemaining.set(ip, rem - 1);
            ip = targetIp + 1;
          } else {
            sectionLoopRemaining.delete(ip);
            ip++;
          }
        } else {
          // Standard subroutine call: LBL n ... LBL 0 (executes repCount + 1 times total)
          if (callStack.length >= maxCallDepth) {
            warnings.push(
              `Line ${callStmt.line}: exceeded maxCallDepth (${maxCallDepth}) calling LBL ${callStmt.label}`,
            );
            truncated = true;
            ip = program.statements.length;
            break;
          }
          callStack.push({
            returnIp: ip + 1,
            labelIp: targetIp,
            remainingRepeats: repCount,
            callLine: callStmt.line,
          });
          ip = targetIp + 1;
        }
        break;
      }

      case 'cycl_def': {
        if (stmt.cycleNumber === 7) {
          // Datum shift activates immediately
          if (stmt.datumShift) {
            if (stmt.datumShift.x) tf.datumX = evalHeidenhainExpr(stmt.datumShift.x, qParams);
            if (stmt.datumShift.y) tf.datumY = evalHeidenhainExpr(stmt.datumShift.y, qParams);
            if (stmt.datumShift.z) tf.datumZ = evalHeidenhainExpr(stmt.datumShift.z, qParams);
          } else {
            // Reset datum shift if no coordinates supplied
            tf.datumX = 0;
            tf.datumY = 0;
            tf.datumZ = 0;
          }
        } else if (stmt.cycleNumber === 8) {
          // Mirroring activates immediately
          const axes = stmt.mirrorAxes ?? [];
          tf.mirrorX = axes.includes('X');
          tf.mirrorY = axes.includes('Y');
        } else if (stmt.cycleNumber === 10) {
          // Coordinate rotation activates immediately
          const angle = stmt.rotationAngle ? evalHeidenhainExpr(stmt.rotationAngle, qParams) : 0;
          tf.rotationDeg = stmt.rotationIncremental ? tf.rotationDeg + angle : angle;
        } else if (stmt.cycleNumber === 1 || stmt.cycleNumber === 200) {
          activeCycle = stmt;
          activeDrillCycle = stmt;
        } else if (stmt.cycleNumber === 220) {
          activeCycle = stmt;
          pendingAutoCycle220 = true;
        } else {
          activeCycle = stmt;
        }
        ip++;
        break;
      }

      case 'cycl_call': {
        executeActiveCycle(stmt.line);
        ip++;
        break;
      }

      case 'm_code': {
        if (stmt.code === 99) {
          executeActiveCycle(stmt.line);
        }
        if (stmt.code === 30 || stmt.code === 2) {
          flushPendingCycle220();
          ip = program.statements.length;
        } else {
          ip++;
        }
        break;
      }
    }
  }

  flushPendingCycle220();

  let stockBounds: StockBounds | undefined;
  if (blkP1 && blkP2) {
    stockBounds = {
      min: {
        x: Math.min(blkP1.x, blkP2.x) * unitScale,
        y: Math.min(blkP1.y, blkP2.y) * unitScale,
        z: Math.min(blkP1.z, blkP2.z) * unitScale,
      },
      max: {
        x: Math.max(blkP1.x, blkP2.x) * unitScale,
        y: Math.max(blkP1.y, blkP2.y) * unitScale,
        z: Math.max(blkP1.z, blkP2.z) * unitScale,
      },
    };
  }

  const metadata: Record<string, unknown> = {
    sourceFormat: 'heidenhain',
    programName: program.name,
    sourceUnits: program.units,
    ...(stockBounds ? { stockBounds } : {}),
  };

  const doc = createEmptyDocument(true, metadata);
  if (segments.length > 0) {
    doc.layers.push({
      id: layerId,
      name: program.name || 'Heidenhain',
      visible: true,
      segments,
    });
    doc.bounds = computeBounds(doc);
  }

  return {
    document: doc,
    warnings,
    qParams,
    ...(stockBounds ? { stockBounds } : {}),
    iterations,
    truncated,
  };
}
