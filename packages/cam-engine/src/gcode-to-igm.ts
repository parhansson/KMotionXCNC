import {
  type ArcPlane,
  type ArcSegment,
  type IgmDocument,
  type IgmSegment,
  type LineSegment,
  type SourceRef,
  type Vec8,
  cloneVec8,
  computeBounds,
  getArcPlaneAxes,
} from '@kmxcnc/igm';

export interface GcodeParseOptions {
  /** Initial unit mode before G20/G21 is seen (default: 'mm'). */
  defaultUnits?: 'mm' | 'in';
  /** Initial arc plane before G17/G18/G19 is seen (default: 'G17'). */
  defaultPlane?: ArcPlane;
  /** Skip lines starting with '/' (block delete). Default: false. */
  blockDelete?: boolean;
  /** Layer id/name for generated segments (default: 'gcode'). */
  layerId?: string;
  /** Maximum total executed blocks/cycle iterations to guard against infinite loops (default: 10_000). */
  maxIterations?: number;
  /** Maximum subroutine M98 call stack depth (default: 32). */
  maxCallDepth?: number;
  /** Optional initial RS274 `#`-parameter values. */
  initialParams?: Record<number, number>;
}

const MM_PER_INCH = 25.4;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const DEFAULT_MAX_ITERATIONS = 10_000;
const DEFAULT_MAX_CALL_DEPTH = 32;

interface ParsedWord {
  letter: string;
  value: number;
}

interface CallFrame {
  subNumber: number;
  startLineIdx: number;
  returnLineIdx: number;
  callLineNum: number;
  remainingCalls: number;
}

type CannedCycle = 'G81' | 'G82' | 'G83' | 'G73';

function stripComments(line: string): string {
  let out = '';
  let depth = 0;
  for (let i = 0; i < line.length; i++) {
    const ch = line.charAt(i);
    if (ch === ';') {
      break;
    }
    if (ch === '(') {
      depth += 1;
      continue;
    }
    if (ch === ')') {
      if (depth > 0) depth -= 1;
      continue;
    }
    if (depth === 0) {
      out += ch;
    }
  }
  return out;
}

function cleanGcodeLine(rawLine: string, blockDelete: boolean): string {
  const trimmed = rawLine.trim();
  if (!trimmed || trimmed === '%') return '';
  if (trimmed.startsWith('/')) {
    if (blockDelete) return '';
  }
  const stripped = stripComments(trimmed.startsWith('/') ? trimmed.slice(1) : trimmed);
  return stripped.toUpperCase().trim();
}

const NUMBER_RE = /^(?:\d+\.?\d*|\.\d+)(?:E[+-]?\d+)?/;
const INT_RE = /^\d+/;

class LineEvaluator {
  private pos = 0;

  constructor(
    private readonly src: string,
    private readonly params: Map<number, number>,
    private readonly lineNum: number,
    private readonly warnings: string[],
  ) {}

  private eof(): boolean {
    return this.pos >= this.src.length;
  }

  private peek(): string {
    return this.src.charAt(this.pos);
  }

  private skipWs(): void {
    while (this.pos < this.src.length) {
      const ch = this.src.charAt(this.pos);
      if (ch === ' ' || ch === '\t') {
        this.pos += 1;
      } else {
        break;
      }
    }
  }

  private matchKeyword(kw: string): boolean {
    if (!this.src.startsWith(kw, this.pos)) return false;
    const nextCh = this.src.charAt(this.pos + kw.length);
    if (nextCh >= 'A' && nextCh <= 'Z') return false;
    this.pos += kw.length;
    return true;
  }

  private parseParamIndex(): number {
    this.skipWs();
    if (this.peek() === '[' || this.peek() === '#') {
      return Math.round(this.parsePrimary());
    }
    const m = INT_RE.exec(this.src.slice(this.pos));
    if (m && m[0]) {
      this.pos += m[0].length;
      return Number.parseInt(m[0], 10);
    }
    return 0;
  }

  private parseExpr(): number {
    return this.parseAdditive();
  }

  private parseAdditive(): number {
    let left = this.parseMultiplicative();
    for (;;) {
      this.skipWs();
      const ch = this.peek();
      if (ch === '+') {
        this.pos += 1;
        left += this.parseMultiplicative();
      } else if (ch === '-') {
        this.pos += 1;
        left -= this.parseMultiplicative();
      } else {
        break;
      }
    }
    return left;
  }

  private parseMultiplicative(): number {
    let left = this.parsePower();
    for (;;) {
      this.skipWs();
      const ch = this.peek();
      if (ch === '*' && !this.src.startsWith('**', this.pos)) {
        this.pos += 1;
        left *= this.parsePower();
      } else if (ch === '/') {
        this.pos += 1;
        const right = this.parsePower();
        if (right === 0) {
          this.warnings.push(`Line ${this.lineNum}: Division by zero in expression.`);
          left = 0;
        } else {
          left /= right;
        }
      } else if (this.matchKeyword('MOD')) {
        const right = this.parsePower();
        if (right === 0) {
          this.warnings.push(`Line ${this.lineNum}: Modulo by zero in expression.`);
          left = 0;
        } else {
          left %= right;
        }
      } else {
        break;
      }
    }
    return left;
  }

  private parsePower(): number {
    const base = this.parseUnary();
    this.skipWs();
    if (this.src.startsWith('**', this.pos)) {
      this.pos += 2;
      const exp = this.parsePower();
      return Math.pow(base, exp);
    }
    return base;
  }

  private parseUnary(): number {
    this.skipWs();
    const ch = this.peek();
    if (ch === '+') {
      this.pos += 1;
      return this.parseUnary();
    }
    if (ch === '-') {
      this.pos += 1;
      return -this.parseUnary();
    }
    return this.parsePrimary();
  }

  private parsePrimary(): number {
    this.skipWs();
    const ch = this.peek();

    if (ch === '[') {
      this.pos += 1;
      const val = this.parseExpr();
      this.skipWs();
      if (this.peek() === ']') {
        this.pos += 1;
      }
      return val;
    }

    if (ch === '#') {
      this.pos += 1;
      const idx = this.parseParamIndex();
      return this.params.get(idx) ?? 0;
    }

    // RS274 math functions (angles in degrees)
    if (ch >= 'A' && ch <= 'Z') {
      if (this.matchKeyword('ATAN')) {
        const y = this.parsePrimary();
        this.skipWs();
        if (this.peek() === '/') {
          this.pos += 1;
          const x = this.parsePrimary();
          return Math.atan2(y, x) * RAD_TO_DEG;
        }
        return Math.atan(y) * RAD_TO_DEG;
      }
      if (this.matchKeyword('ASIN')) {
        const v = this.parsePrimary();
        return Math.asin(Math.max(-1, Math.min(1, v))) * RAD_TO_DEG;
      }
      if (this.matchKeyword('ACOS')) {
        const v = this.parsePrimary();
        return Math.acos(Math.max(-1, Math.min(1, v))) * RAD_TO_DEG;
      }
      if (this.matchKeyword('SIN')) {
        return Math.sin(this.parsePrimary() * DEG_TO_RAD);
      }
      if (this.matchKeyword('COS')) {
        return Math.cos(this.parsePrimary() * DEG_TO_RAD);
      }
      if (this.matchKeyword('TAN')) {
        return Math.tan(this.parsePrimary() * DEG_TO_RAD);
      }
      if (this.matchKeyword('SQRT')) {
        const v = this.parsePrimary();
        if (v < 0) {
          this.warnings.push(`Line ${this.lineNum}: SQRT of negative number (${v}).`);
          return 0;
        }
        return Math.sqrt(v);
      }
      if (this.matchKeyword('ABS')) {
        return Math.abs(this.parsePrimary());
      }
      if (this.matchKeyword('ROUND')) {
        return Math.round(this.parsePrimary());
      }
      if (this.matchKeyword('FIX')) {
        return Math.floor(this.parsePrimary());
      }
      if (this.matchKeyword('FUP')) {
        return Math.ceil(this.parsePrimary());
      }
      if (this.matchKeyword('EXP')) {
        return Math.exp(this.parsePrimary());
      }
      if (this.matchKeyword('LN')) {
        const v = this.parsePrimary();
        if (v <= 0) {
          this.warnings.push(`Line ${this.lineNum}: LN of non-positive number (${v}).`);
          return 0;
        }
        return Math.log(v);
      }
    }

    const m = NUMBER_RE.exec(this.src.slice(this.pos));
    if (m && m[0]) {
      this.pos += m[0].length;
      return Number.parseFloat(m[0]);
    }

    return Number.NaN;
  }

  public evaluateLine(): ParsedWord[] {
    const words: ParsedWord[] = [];
    while (!this.eof()) {
      this.skipWs();
      if (this.eof()) break;

      const startPos = this.pos;
      const ch = this.peek();

      // Parameter assignment: #<n> = <expr>
      if (ch === '#') {
        this.pos += 1;
        const idx = this.parseParamIndex();
        this.skipWs();
        if (this.peek() === '=') {
          this.pos += 1;
          const val = this.parseExpr();
          if (Number.isFinite(val)) {
            this.params.set(idx, val);
          }
          continue;
        }
        // Stray `#` without `=` — skip
        continue;
      }

      if (ch >= 'A' && ch <= 'Z') {
        this.pos += 1;
        if (ch === 'N') {
          // Line number: consume digits and skip
          this.skipWs();
          const m = NUMBER_RE.exec(this.src.slice(this.pos));
          if (m && m[0]) {
            this.pos += m[0].length;
          }
          continue;
        }

        const value = this.parseUnary();
        if (Number.isFinite(value)) {
          words.push({ letter: ch, value });
        }
        continue;
      }

      // Advance past any unrecognized character to guarantee forward progress
      if (this.pos === startPos) {
        this.pos += 1;
      }
    }
    return words;
  }
}

/**
 * Extracts a leading subroutine label `O<num>` from a cleaned uppercase line, if present.
 */
function extractSubroutineLabel(cleanLine: string): number | null {
  if (!cleanLine) return null;
  // Allow optional N<num> before O<num>
  const match = /^(?:N\d+\s*)?O\s*(\d+)\b/.exec(cleanLine);
  if (!match || !match[1]) return null;
  return Number.parseInt(match[1], 10);
}

/**
 * Computes arc center in (u, v) plane from R-format arc specification.
 * Positive R chooses the minor arc (<= 180 deg); negative R chooses the major arc (> 180 deg).
 */
function computeCenterFromRadius(
  su: number,
  sv: number,
  eu: number,
  ev: number,
  rSigned: number,
  clockwise: boolean,
): { cu: number; cv: number } {
  const du = eu - su;
  const dv = ev - sv;
  const chord = Math.hypot(du, dv);
  if (chord < 1e-12) {
    return { cu: su + Math.abs(rSigned), cv: sv };
  }
  const r = Math.abs(rSigned);
  const halfChord = chord / 2;
  const hSq = Math.max(0, r * r - halfChord * halfChord);
  const h = Math.sqrt(hSq);

  const mu = (su + eu) / 2;
  const mv = (sv + ev) / 2;

  // Unit normal to the left of start->end vector: (-dv/chord, du/chord)
  const nu = -dv / chord;
  const nv = du / chord;

  // For CCW (clockwise=false) + minor arc (rSigned > 0), center is to the LEFT of chord (+normal).
  // For CW (clockwise=true) + minor arc (rSigned > 0), center is to the RIGHT of chord (-normal).
  // Negative R flips the side to produce the major arc.
  const leftSide = (!clockwise && rSigned > 0) || (clockwise && rSigned < 0);
  const sign = leftSide ? 1 : -1;

  return {
    cu: mu + sign * h * nu,
    cv: mv + sign * h * nv,
  };
}

/**
 * Parses G-code text into an executable IGM document (canonical mm, 8 axes X-V).
 * Supports RS274/KMotionX subroutines (`O<n>`, `M98 P.. L..`, `M99`, `M30`/`M2`),
 * `#`-parameter assignments & math expressions, and canned drilling cycles (`G81`, `G82`, `G83`, `G73`, `G80`, `G98`, `G99`).
 * Preserves exact segment order and 1-based line numbers (with `callStack` for subroutines) in `sourceRef`.
 */
export function parseGcodeToIgm(
  gcode: string,
  options: GcodeParseOptions = {},
): IgmDocument {
  const blockDelete = options.blockDelete ?? false;
  const layerId = options.layerId ?? 'gcode';
  const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const maxCallDepth = options.maxCallDepth ?? DEFAULT_MAX_CALL_DEPTH;

  let unitScale = options.defaultUnits === 'in' ? MM_PER_INCH : 1;
  let plane: ArcPlane = options.defaultPlane ?? 'G17';
  let absoluteCoords = true; // G90
  let absoluteArcCenters = false; // G91.1 default
  let motionMode: 'G0' | 'G1' | 'G2' | 'G3' | null = 'G0';
  let feedRate: number | undefined;

  // Canned drilling cycle modal state
  let cannedCycle: CannedCycle | null = null;
  let retractMode: 'G98' | 'G99' = 'G98';
  let cycleInitialZ: number | null = null;
  let cycleR: number | undefined;
  let cycleZ: number | undefined;
  let cycleQ: number | undefined;

  // RS274 `#`-parameters
  const paramStore = new Map<number, number>();
  if (options.initialParams) {
    for (const [k, v] of Object.entries(options.initialParams)) {
      const idx = Number(k);
      if (Number.isFinite(idx) && Number.isFinite(v)) {
        paramStore.set(Math.round(idx), v);
      }
    }
  }

  const pos: Vec8 = { x: 0, y: 0, z: 0 };
  const segments: IgmSegment[] = [];
  const warnings: string[] = [];

  const lines = gcode.split(/\r?\n/);
  const cleanedLines = lines.map((raw) => cleanGcodeLine(raw, blockDelete));

  // Pre-scan subroutine labels (`O<num>`)
  const subroutines = new Map<number, number>();
  for (let i = 0; i < cleanedLines.length; i++) {
    const label = extractSubroutineLabel(cleanedLines[i] ?? '');
    if (label !== null && !subroutines.has(label)) {
      subroutines.set(label, i);
    }
  }

  const callStack: CallFrame[] = [];

  const makeSourceRef = (lineNum: number): SourceRef => {
    if (callStack.length === 0) {
      return { kind: 'gcode', line: lineNum };
    }
    return {
      kind: 'gcode',
      line: lineNum,
      callStack: callStack.map((f) => f.callLineNum),
    };
  };

  const emitLine = (
    kind: 'rapid' | 'cut',
    target: Vec8,
    lineNum: number,
  ): void => {
    const dx = target.x - pos.x;
    const dy = target.y - pos.y;
    const dz = target.z - pos.z;
    if (Math.abs(dx) < 1e-12 && Math.abs(dy) < 1e-12 && Math.abs(dz) < 1e-12) {
      return;
    }
    const seg: LineSegment = {
      type: 'line',
      kind,
      start: cloneVec8(pos),
      end: cloneVec8(target),
      layer: layerId,
      sourceRef: makeSourceRef(lineNum),
      ...(kind === 'cut' && feedRate !== undefined ? { feedRate } : {}),
    };
    segments.push(seg);
    pos.x = target.x;
    pos.y = target.y;
    pos.z = target.z;
  };

  let pc = 0;
  let iterations = 0;

  while (pc >= 0 && pc < cleanedLines.length) {
    iterations += 1;
    if (iterations > maxIterations) {
      warnings.push(
        `Execution stopped at line ${pc + 1}: maxIterations (${maxIterations}) exceeded.`,
      );
      break;
    }

    const lineNum = pc + 1;
    const clean = cleanedLines[pc] ?? '';
    if (!clean) {
      pc += 1;
      continue;
    }

    const evaluator = new LineEvaluator(clean, paramStore, lineNum, warnings);
    const words = evaluator.evaluateLine();
    if (words.length === 0) {
      pc += 1;
      continue;
    }

    // Collect parameters & control codes on this block
    const params: Record<string, number> = {};
    let hasAxisWord = false;
    let hasArcOffset = false;
    let blockMotion: 'G0' | 'G1' | 'G2' | 'G3' | null = null;
    let blockCannedCycle: CannedCycle | null = null;
    let hasM98 = false;
    let hasM99 = false;
    let hasProgramEnd = false;

    for (const w of words) {
      if (w.letter === 'G') {
        const code = Math.round(w.value * 10) / 10;
        switch (code) {
          case 0:
            motionMode = 'G0';
            blockMotion = 'G0';
            cannedCycle = null;
            cycleInitialZ = null;
            break;
          case 1:
            motionMode = 'G1';
            blockMotion = 'G1';
            cannedCycle = null;
            cycleInitialZ = null;
            break;
          case 2:
            motionMode = 'G2';
            blockMotion = 'G2';
            cannedCycle = null;
            cycleInitialZ = null;
            break;
          case 3:
            motionMode = 'G3';
            blockMotion = 'G3';
            cannedCycle = null;
            cycleInitialZ = null;
            break;
          case 17:
            plane = 'G17';
            break;
          case 18:
            plane = 'G18';
            break;
          case 19:
            plane = 'G19';
            break;
          case 20:
            unitScale = MM_PER_INCH;
            break;
          case 21:
            unitScale = 1;
            break;
          case 73:
            if (cannedCycle === null) cycleInitialZ = pos.z;
            cannedCycle = 'G73';
            blockCannedCycle = 'G73';
            motionMode = null;
            break;
          case 80:
            motionMode = null;
            cannedCycle = null;
            cycleInitialZ = null;
            break;
          case 81:
            if (cannedCycle === null) cycleInitialZ = pos.z;
            cannedCycle = 'G81';
            blockCannedCycle = 'G81';
            motionMode = null;
            break;
          case 82:
            if (cannedCycle === null) cycleInitialZ = pos.z;
            cannedCycle = 'G82';
            blockCannedCycle = 'G82';
            motionMode = null;
            break;
          case 83:
            if (cannedCycle === null) cycleInitialZ = pos.z;
            cannedCycle = 'G83';
            blockCannedCycle = 'G83';
            motionMode = null;
            break;
          case 90:
            absoluteCoords = true;
            break;
          case 90.1:
            absoluteArcCenters = true;
            break;
          case 91:
            absoluteCoords = false;
            break;
          case 91.1:
            absoluteArcCenters = false;
            break;
          case 98:
            retractMode = 'G98';
            break;
          case 99:
            retractMode = 'G99';
            break;
          default:
            break;
        }
      } else if (w.letter === 'M') {
        const mCode = Math.round(w.value);
        if (mCode === 98) {
          hasM98 = true;
        } else if (mCode === 99) {
          hasM99 = true;
        } else if (mCode === 2 || mCode === 30) {
          hasProgramEnd = true;
        }
      } else if (w.letter === 'F') {
        if (w.value > 0) {
          feedRate = w.value * unitScale;
        }
      } else if (
        w.letter === 'X' ||
        w.letter === 'Y' ||
        w.letter === 'Z' ||
        w.letter === 'A' ||
        w.letter === 'B' ||
        w.letter === 'C' ||
        w.letter === 'U' ||
        w.letter === 'V'
      ) {
        params[w.letter] = w.value;
        hasAxisWord = true;
      } else if (w.letter === 'I' || w.letter === 'J' || w.letter === 'K' || w.letter === 'R') {
        params[w.letter] = w.value;
        hasArcOffset = true;
      } else if (w.letter === 'P' || w.letter === 'Q' || w.letter === 'L') {
        params[w.letter] = w.value;
      }
    }

    // Execute canned drilling cycle if active and triggered by cycle G-code or axis words
    const activeCycle = blockCannedCycle ?? (hasAxisWord ? cannedCycle : null);
    if (activeCycle) {
      const initialZ = cycleInitialZ ?? pos.z;

      if (params.R !== undefined) {
        cycleR = absoluteCoords ? params.R * unitScale : initialZ + params.R * unitScale;
      }
      if (params.Z !== undefined) {
        cycleZ = absoluteCoords
          ? params.Z * unitScale
          : (cycleR ?? initialZ) + params.Z * unitScale;
      }
      if (params.Q !== undefined) {
        cycleQ = Math.abs(params.Q * unitScale);
      }

      const lCount = params.L !== undefined ? Math.max(0, Math.round(params.L)) : 1;
      const rPlane = cycleR ?? pos.z;
      const bottomZ = cycleZ ?? pos.z;
      const retractZ = retractMode === 'G98' ? Math.max(initialZ, rPlane) : rPlane;

      for (let rep = 0; rep < lCount; rep++) {
        if (rep > 0) {
          iterations += 1;
          if (iterations > maxIterations) {
            warnings.push(
              `Execution stopped at line ${lineNum}: maxIterations (${maxIterations}) exceeded in canned cycle.`,
            );
            break;
          }
        }

        const holeX =
          params.X !== undefined
            ? absoluteCoords
              ? params.X * unitScale
              : pos.x + params.X * unitScale
            : pos.x;
        const holeY =
          params.Y !== undefined
            ? absoluteCoords
              ? params.Y * unitScale
              : pos.y + params.Y * unitScale
            : pos.y;

        // 1. If currently below R plane, rapid up to R plane before XY traverse
        if (pos.z < rPlane - 1e-12) {
          emitLine('rapid', { ...pos, z: rPlane }, lineNum);
        }

        // 2. Rapid XY to hole position
        emitLine('rapid', { ...pos, x: holeX, y: holeY }, lineNum);

        // 3. Rapid Z down to R plane
        emitLine('rapid', { ...pos, z: rPlane }, lineNum);

        // 4. Drill motion from R plane to bottomZ
        if (
          (activeCycle === 'G83' || activeCycle === 'G73') &&
          cycleQ !== undefined &&
          cycleQ > 1e-9 &&
          bottomZ < rPlane - 1e-9
        ) {
          const isDeepPeck = activeCycle === 'G83';
          const chipBreakRetract = Math.min(1.0, cycleQ * 0.25);
          const rapidClearance = Math.min(0.5, cycleQ * 0.1);
          let currentDepth = rPlane;
          let firstPeck = true;

          while (currentDepth > bottomZ + 1e-9) {
            iterations += 1;
            if (iterations > maxIterations) {
              warnings.push(
                `Execution stopped at line ${lineNum}: maxIterations (${maxIterations}) exceeded during peck cycle.`,
              );
              break;
            }

            const nextDepth = Math.max(bottomZ, currentDepth - cycleQ);

            if (isDeepPeck && !firstPeck) {
              const approachZ = Math.min(rPlane, currentDepth + rapidClearance);
              emitLine('rapid', { ...pos, z: approachZ }, lineNum);
            }

            // Cut to nextDepth
            emitLine('cut', { ...pos, z: nextDepth }, lineNum);

            const hasMorePecks = nextDepth > bottomZ + 1e-9;
            if (hasMorePecks) {
              if (isDeepPeck) {
                // G83: full rapid retract to R plane
                emitLine('rapid', { ...pos, z: rPlane }, lineNum);
              } else {
                // G73: small chip-break rapid retract
                const chipZ = Math.min(rPlane, nextDepth + chipBreakRetract);
                emitLine('rapid', { ...pos, z: chipZ }, lineNum);
              }
            }

            currentDepth = nextDepth;
            firstPeck = false;
          }
        } else {
          // G81 / G82 (or peck cycle without Q): single plunge cut to bottomZ
          emitLine('cut', { ...pos, z: bottomZ }, lineNum);
        }

        // 5. Final retract (G98 -> initial Z, G99 -> R plane)
        emitLine('rapid', { ...pos, z: retractZ }, lineNum);
      }

      if (iterations > maxIterations) {
        break;
      }
    } else if (hasAxisWord || hasArcOffset) {
      const activeMotion = blockMotion ?? motionMode;
      if (activeMotion) {
        const start = cloneVec8(pos);
        const end = cloneVec8(pos);

        const updateLinear = (
          letter: 'X' | 'Y' | 'Z' | 'U' | 'V',
          axis: 'x' | 'y' | 'z' | 'u' | 'v',
        ) => {
          const raw = params[letter];
          if (raw === undefined) return;
          const valMm = raw * unitScale;
          if (absoluteCoords) {
            end[axis] = valMm;
          } else {
            end[axis] = (pos[axis] ?? 0) + valMm;
          }
        };

        const updateRotary = (letter: 'A' | 'B' | 'C', axis: 'a' | 'b' | 'c') => {
          const raw = params[letter];
          if (raw === undefined) return;
          // Rotary axes are in degrees regardless of G20/G21
          if (absoluteCoords) {
            end[axis] = raw;
          } else {
            end[axis] = (pos[axis] ?? 0) + raw;
          }
        };

        updateLinear('X', 'x');
        updateLinear('Y', 'y');
        updateLinear('Z', 'z');
        updateLinear('U', 'u');
        updateLinear('V', 'v');
        updateRotary('A', 'a');
        updateRotary('B', 'b');
        updateRotary('C', 'c');

        if (activeMotion === 'G0' || activeMotion === 'G1') {
          const seg: LineSegment = {
            type: 'line',
            kind: activeMotion === 'G0' ? 'rapid' : 'cut',
            start,
            end,
            layer: layerId,
            sourceRef: makeSourceRef(lineNum),
            ...(activeMotion === 'G1' && feedRate !== undefined ? { feedRate } : {}),
          };
          segments.push(seg);
        } else {
          // G2 (clockwise) or G3 (counter-clockwise)
          const clockwise = activeMotion === 'G2';
          const axes = getArcPlaneAxes(plane);

          const center: { x: number; y: number; z?: number } = {
            x: start.x,
            y: start.y,
            z: start.z,
          };

          if (params.R !== undefined) {
            const rMm = params.R * unitScale;
            const { cu, cv } = computeCenterFromRadius(
              start[axes.u],
              start[axes.v],
              end[axes.u],
              end[axes.v],
              rMm,
              clockwise,
            );
            center[axes.u] = cu;
            center[axes.v] = cv;
          } else {
            const iVal = params.I !== undefined ? params.I * unitScale : 0;
            const jVal = params.J !== undefined ? params.J * unitScale : 0;
            const kVal = params.K !== undefined ? params.K * unitScale : 0;

            if (params.I === undefined && params.J === undefined && params.K === undefined) {
              warnings.push(`Line ${lineNum}: Arc ${activeMotion} missing I/J/K or R parameter.`);
            }

            if (absoluteArcCenters) {
              if (params.I !== undefined) center.x = iVal;
              if (params.J !== undefined) center.y = jVal;
              if (params.K !== undefined) center.z = kVal;
            } else {
              center.x = start.x + iVal;
              center.y = start.y + jVal;
              center.z = start.z + kVal;
            }
          }

          const seg: ArcSegment = {
            type: 'arc',
            kind: 'cut',
            start,
            end,
            center,
            clockwise,
            plane,
            layer: layerId,
            sourceRef: makeSourceRef(lineNum),
            ...(feedRate !== undefined ? { feedRate } : {}),
          };
          segments.push(seg);
        }

        // Advance modal position
        pos.x = end.x;
        pos.y = end.y;
        pos.z = end.z;
        if (end.a !== undefined) pos.a = end.a;
        if (end.b !== undefined) pos.b = end.b;
        if (end.c !== undefined) pos.c = end.c;
        if (end.u !== undefined) pos.u = end.u;
        if (end.v !== undefined) pos.v = end.v;
      }
    }

    // Handle program control flow (M30 / M2 / M98 / M99)
    if (hasProgramEnd) {
      break;
    }

    if (hasM98) {
      const targetSub = params.P !== undefined ? Math.round(params.P) : null;
      const repeatCount = params.L !== undefined ? Math.round(params.L) : 1;

      if (targetSub === null) {
        warnings.push(`Line ${lineNum}: M98 missing P<subroutine> parameter.`);
        pc += 1;
        continue;
      }

      if (repeatCount <= 0) {
        // L=0 skips subroutine call
        pc += 1;
        continue;
      }

      const subIdx = subroutines.get(targetSub);
      if (subIdx === undefined) {
        warnings.push(`Line ${lineNum}: Subroutine O${targetSub} not found.`);
        pc += 1;
        continue;
      }

      if (callStack.length >= maxCallDepth) {
        warnings.push(
          `Line ${lineNum}: Max subroutine call depth (${maxCallDepth}) exceeded calling O${targetSub}.`,
        );
        pc += 1;
        continue;
      }

      callStack.push({
        subNumber: targetSub,
        startLineIdx: subIdx,
        returnLineIdx: pc + 1,
        callLineNum: lineNum,
        remainingCalls: repeatCount - 1,
      });
      pc = subIdx;
      continue;
    }

    if (hasM99) {
      if (callStack.length === 0) {
        // Top-level M99: stop cleanly without looping forever
        break;
      }
      const frame = callStack[callStack.length - 1]!;
      if (frame.remainingCalls > 0) {
        frame.remainingCalls -= 1;
        pc = frame.startLineIdx;
      } else {
        callStack.pop();
        pc = frame.returnLineIdx;
      }
      continue;
    }

    pc += 1;
  }

  const layers = [
    {
      id: layerId,
      name: 'G-Code',
      visible: true,
      segments,
    },
  ];

  return {
    version: 1,
    units: 'mm',
    executable: true,
    layers,
    bounds: computeBounds(layers),
    metadata: {
      source: 'gcode',
      lineCount: lines.length,
      ...(warnings.length > 0 ? { warnings } : {}),
    },
  };
}
