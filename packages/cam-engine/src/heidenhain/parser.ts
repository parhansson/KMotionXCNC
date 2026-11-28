import type {
  ArcDirection,
  ArcMoveNode,
  ArcRadiusMoveNode,
  AxisLetter,
  BeginPgmNode,
  BlkFormNode,
  CallLabelNode,
  CircleCenterNode,
  CyclCallNode,
  CyclDefNode,
  EndPgmNode,
  FnCompareOp,
  FnConditionalGotoNode,
  FnMathOp,
  HeidenhainExpr,
  HeidenhainProgram,
  HeidenhainStatement,
  HeidenhainUnit,
  LabelDefNode,
  LinearIncrementalFlags,
  LinearMoveNode,
  MCodeNode,
  PolarArcMoveNode,
  PolarLinearMoveNode,
  QParamAssignNode,
  RadiusComp,
  ToolCallNode,
} from './ast';

// ---------------------------------------------------------------------------
// Expression parser (numbers, Q<n>, unary +/-, binary + - * /, parentheses)
// ---------------------------------------------------------------------------

interface ExprToken {
  kind: 'num' | 'qparam' | 'op' | 'lparen' | 'rparen';
  text: string;
  value?: number;
}

function tokenizeExpr(input: string): ExprToken[] {
  const tokens: ExprToken[] = [];
  let i = 0;
  const s = input.trim();

  while (i < s.length) {
    const ch = s[i]!;
    if (ch === ' ' || ch === '\t') {
      i++;
      continue;
    }
    if (ch === '(') {
      tokens.push({ kind: 'lparen', text: '(' });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ kind: 'rparen', text: ')' });
      i++;
      continue;
    }
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/') {
      tokens.push({ kind: 'op', text: ch });
      i++;
      continue;
    }
    if (ch === 'Q' || ch === 'q') {
      let j = i + 1;
      while (j < s.length && s[j]! >= '0' && s[j]! <= '9') j++;
      if (j > i + 1) {
        const idx = Number.parseInt(s.slice(i + 1, j), 10);
        tokens.push({ kind: 'qparam', text: s.slice(i, j), value: idx });
        i = j;
        continue;
      }
    }
    if ((ch >= '0' && ch <= '9') || ch === '.') {
      let j = i;
      let hasDot = false;
      while (j < s.length) {
        const c = s[j]!;
        if (c >= '0' && c <= '9') {
          j++;
        } else if (c === '.' && !hasDot) {
          hasDot = true;
          j++;
        } else {
          break;
        }
      }
      const num = Number.parseFloat(s.slice(i, j));
      tokens.push({ kind: 'num', text: s.slice(i, j), value: num });
      i = j;
      continue;
    }
    // Unexpected character in expression
    throw new Error(`Unexpected token "${ch}" in expression "${input}"`);
  }

  return tokens;
}

class ExprParser {
  private pos = 0;
  constructor(private readonly tokens: ExprToken[]) {}

  parse(): HeidenhainExpr {
    const expr = this.parseAddSub();
    if (this.pos < this.tokens.length) {
      throw new Error(`Unexpected trailing token "${this.tokens[this.pos]?.text}"`);
    }
    return expr;
  }

  private peek(): ExprToken | undefined {
    return this.tokens[this.pos];
  }

  private consume(): ExprToken {
    const t = this.tokens[this.pos];
    if (!t) throw new Error('Unexpected end of expression');
    this.pos++;
    return t;
  }

  private parseAddSub(): HeidenhainExpr {
    let left = this.parseMulDiv();
    while (true) {
      const t = this.peek();
      if (t && t.kind === 'op' && (t.text === '+' || t.text === '-')) {
        this.consume();
        const right = this.parseMulDiv();
        left = { type: 'binary', op: t.text, left, right };
      } else {
        break;
      }
    }
    return left;
  }

  private parseMulDiv(): HeidenhainExpr {
    let left = this.parseUnary();
    while (true) {
      const t = this.peek();
      if (t && t.kind === 'op' && (t.text === '*' || t.text === '/')) {
        this.consume();
        const right = this.parseUnary();
        left = { type: 'binary', op: t.text, left, right };
      } else {
        break;
      }
    }
    return left;
  }

  private parseUnary(): HeidenhainExpr {
    const t = this.peek();
    if (t && t.kind === 'op' && (t.text === '+' || t.text === '-')) {
      this.consume();
      const operand = this.parseUnary();
      if (t.text === '+' && operand.type === 'number') {
        return operand;
      }
      if (t.text === '-' && operand.type === 'number') {
        return { type: 'number', value: -operand.value };
      }
      return { type: 'unary', op: t.text, operand };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): HeidenhainExpr {
    const t = this.peek();
    if (!t) throw new Error('Unexpected end of expression');

    if (t.kind === 'num') {
      this.consume();
      return { type: 'number', value: t.value ?? 0 };
    }
    if (t.kind === 'qparam') {
      this.consume();
      return { type: 'qparam', index: t.value ?? 0 };
    }
    if (t.kind === 'lparen') {
      this.consume();
      const inner = this.parseAddSub();
      const close = this.peek();
      if (!close || close.kind !== 'rparen') {
        throw new Error('Missing closing parenthesis in expression');
      }
      this.consume();
      return inner;
    }
    throw new Error(`Unexpected token "${t.text}" in expression`);
  }
}

export function parseHeidenhainExpr(raw: string): HeidenhainExpr {
  const cleaned = raw.trim();
  if (!cleaned) {
    throw new Error('Empty expression');
  }
  const tokens = tokenizeExpr(cleaned);
  return new ExprParser(tokens).parse();
}

// ---------------------------------------------------------------------------
// Line cleaning & tokenization helpers
// ---------------------------------------------------------------------------

function stripComment(line: string): string {
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ';' && !inQuotes) {
      return line.slice(0, i);
    }
  }
  return line;
}

function stripBlockNumber(line: string): string {
  const trimmed = line.trim();
  // Strip optional leading block number: "0 BEGIN..." or "12 L X+10" or "N10 L X+10"
  const match = /^(?:N)?\d+\s+(.*)$/i.exec(trimmed);
  if (match && match[1] !== undefined) {
    return match[1].trim();
  }
  return trimmed;
}

/**
 * Splits a Klartext block into space-delimited tokens while keeping quoted
 * strings and parenthesized expressions together.
 */
function splitBlockTokens(text: string): string[] {
  const tokens: string[] = [];
  let cur = '';
  let inQuotes = false;
  let parenDepth = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === '"') {
      inQuotes = !inQuotes;
      cur += ch;
    } else if (!inQuotes && ch === '(') {
      parenDepth++;
      cur += ch;
    } else if (!inQuotes && ch === ')') {
      parenDepth = Math.max(0, parenDepth - 1);
      cur += ch;
    } else if (!inQuotes && parenDepth === 0 && (ch === ' ' || ch === '\t')) {
      if (cur.length > 0) {
        tokens.push(cur);
        cur = '';
      }
    } else {
      cur += ch;
    }
  }
  if (cur.length > 0) {
    tokens.push(cur);
  }
  return tokens;
}

function parseLabelRef(raw: string): number | string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
    return trimmed.slice(1, -1);
  }
  const num = Number.parseInt(trimmed, 10);
  if (!Number.isNaN(num) && String(num) === trimmed) {
    return num;
  }
  return trimmed;
}

function parseUnits(raw: string | undefined): HeidenhainUnit {
  if (!raw) return 'mm';
  const upper = raw.toUpperCase();
  if (upper === 'INCH' || upper === 'IN') return 'in';
  return 'mm';
}

function tryParseExpr(raw: string, line: number, warnings: string[]): HeidenhainExpr | undefined {
  try {
    return parseHeidenhainExpr(raw);
  } catch (err) {
    warnings.push(
      `Line ${line}: failed to parse expression "${raw}" (${err instanceof Error ? err.message : String(err)})`,
    );
    return undefined;
  }
}

/**
 * Parses common motion tail tokens (comp, FMAX, F AUTO, F<expr>, M<code>).
 */
interface MotionTail {
  comp?: RadiusComp;
  fMax?: boolean;
  fAuto?: boolean;
  feedRate?: HeidenhainExpr;
  mCodes: number[];
}

function parseMotionTailToken(
  token: string,
  nextToken: string | undefined,
  tail: MotionTail,
  line: number,
  warnings: string[],
): number {
  const upper = token.toUpperCase();

  if (upper === 'R0' || upper === 'RL' || upper === 'RR') {
    tail.comp = upper;
    return 1;
  }
  if (upper === 'FMAX') {
    tail.fMax = true;
    return 1;
  }
  if (upper === 'FAUTO') {
    tail.fAuto = true;
    return 1;
  }
  if (upper === 'F' && nextToken) {
    const nextUpper = nextToken.toUpperCase();
    if (nextUpper === 'MAX') {
      tail.fMax = true;
      return 2;
    }
    if (nextUpper === 'AUTO') {
      tail.fAuto = true;
      return 2;
    }
    const expr = tryParseExpr(nextToken, line, warnings);
    if (expr) tail.feedRate = expr;
    return 2;
  }
  if (upper.startsWith('F') && token.length > 1) {
    const rest = token.slice(1);
    if (rest.toUpperCase() === 'AUTO') {
      tail.fAuto = true;
      return 1;
    }
    if (rest.toUpperCase() === 'MAX') {
      tail.fMax = true;
      return 1;
    }
    const expr = tryParseExpr(rest, line, warnings);
    if (expr) tail.feedRate = expr;
    return 1;
  }
  if (/^M\d+$/i.test(token)) {
    tail.mCodes.push(Number.parseInt(token.slice(1), 10));
    return 1;
  }
  if (upper === 'M' && nextToken && /^\d+$/.test(nextToken)) {
    tail.mCodes.push(Number.parseInt(nextToken, 10));
    return 2;
  }
  return 0;
}

function applyMotionTail<
  T extends {
    comp?: RadiusComp;
    fMax?: boolean;
    fAuto?: boolean;
    feedRate?: HeidenhainExpr;
    mCode?: number;
    mCodes?: number[];
  },
>(node: T, tail: MotionTail): T {
  if (tail.comp) node.comp = tail.comp;
  if (tail.fMax) node.fMax = true;
  if (tail.fAuto) node.fAuto = true;
  if (tail.feedRate) node.feedRate = tail.feedRate;
  if (tail.mCodes.length > 0) {
    node.mCode = tail.mCodes[0];
    node.mCodes = tail.mCodes;
  }
  return node;
}

// ---------------------------------------------------------------------------
// Statement parsers
// ---------------------------------------------------------------------------

function parseLinearMove(tokens: string[], line: number, warnings: string[]): LinearMoveNode {
  const incremental: LinearIncrementalFlags = {};
  const node: LinearMoveNode = {
    type: 'linear',
    line,
    incremental,
  };
  const tail: MotionTail = { mCodes: [] };

  let i = 1;
  while (i < tokens.length) {
    const tok = tokens[i]!;
    const next = tokens[i + 1];

    const consumed = parseMotionTailToken(tok, next, tail, line, warnings);
    if (consumed > 0) {
      i += consumed;
      continue;
    }

    const axisMatch = /^(I)?([XYZABC])(.+)?$/i.exec(tok);
    if (axisMatch) {
      const isInc = Boolean(axisMatch[1]);
      const axis = axisMatch[2]!.toLowerCase() as 'x' | 'y' | 'z' | 'a' | 'b' | 'c';
      let rawVal = axisMatch[3];
      if (!rawVal && next !== undefined) {
        rawVal = next;
        i++;
      }
      if (rawVal) {
        const expr = tryParseExpr(rawVal, line, warnings);
        if (expr) {
          node[axis] = expr;
          if (isInc) incremental[axis] = true;
        }
      }
      i++;
      continue;
    }

    warnings.push(`Line ${line}: unrecognized token "${tok}" in L block`);
    i++;
  }

  return applyMotionTail(node, tail);
}

function parseCircleCenter(tokens: string[], line: number, warnings: string[]): CircleCenterNode {
  const node: CircleCenterNode = {
    type: 'circle_center',
    line,
    incremental: {},
  };

  let i = 1;
  while (i < tokens.length) {
    const tok = tokens[i]!;
    const next = tokens[i + 1];
    const m = /^(I)?([XY])(.+)?$/i.exec(tok);
    if (m) {
      const isInc = Boolean(m[1]);
      const axis = m[2]!.toLowerCase() as 'x' | 'y';
      let rawVal = m[3];
      if (!rawVal && next !== undefined) {
        rawVal = next;
        i++;
      }
      if (rawVal) {
        const expr = tryParseExpr(rawVal, line, warnings);
        if (expr) {
          node[axis] = expr;
          if (isInc) node.incremental[axis] = true;
        }
      }
      i++;
      continue;
    }
    warnings.push(`Line ${line}: unrecognized token "${tok}" in CC block`);
    i++;
  }
  return node;
}

function parseArcMove(tokens: string[], line: number, warnings: string[]): ArcMoveNode {
  const node: ArcMoveNode = {
    type: 'arc',
    line,
    incremental: {},
    dr: '+',
  };
  const tail: MotionTail = { mCodes: [] };

  let i = 1;
  while (i < tokens.length) {
    const tok = tokens[i]!;
    const next = tokens[i + 1];
    const upper = tok.toUpperCase();

    if (upper === 'DR+' || upper === 'DR-') {
      node.dr = upper[2] as ArcDirection;
      i++;
      continue;
    }

    const consumed = parseMotionTailToken(tok, next, tail, line, warnings);
    if (consumed > 0) {
      i += consumed;
      continue;
    }

    const m = /^(I)?([XYZ])(.+)?$/i.exec(tok);
    if (m) {
      const isInc = Boolean(m[1]);
      const axis = m[2]!.toLowerCase() as 'x' | 'y' | 'z';
      let rawVal = m[3];
      if (!rawVal && next !== undefined) {
        rawVal = next;
        i++;
      }
      if (rawVal) {
        const expr = tryParseExpr(rawVal, line, warnings);
        if (expr) {
          node[axis] = expr;
          if (isInc) node.incremental[axis] = true;
        }
      }
      i++;
      continue;
    }

    warnings.push(`Line ${line}: unrecognized token "${tok}" in C block`);
    i++;
  }

  return applyMotionTail(node, tail);
}

function parseArcRadiusMove(tokens: string[], line: number, warnings: string[]): ArcRadiusMoveNode {
  const node: ArcRadiusMoveNode = {
    type: 'arc_radius',
    line,
    incremental: {},
    radius: { type: 'number', value: 0 },
    dr: '+',
  };
  const tail: MotionTail = { mCodes: [] };

  let i = 1;
  while (i < tokens.length) {
    const tok = tokens[i]!;
    const next = tokens[i + 1];
    const upper = tok.toUpperCase();

    if (upper === 'DR+' || upper === 'DR-') {
      node.dr = upper[2] as ArcDirection;
      i++;
      continue;
    }

    const consumed = parseMotionTailToken(tok, next, tail, line, warnings);
    if (consumed > 0) {
      i += consumed;
      continue;
    }

    if (/^R(?![0LR]$)(.+)?$/i.test(tok)) {
      let rawVal = tok.slice(1);
      if (!rawVal && next !== undefined) {
        rawVal = next;
        i++;
      }
      const expr = tryParseExpr(rawVal, line, warnings);
      if (expr) node.radius = expr;
      i++;
      continue;
    }

    const m = /^(I)?([XYZ])(.+)?$/i.exec(tok);
    if (m) {
      const isInc = Boolean(m[1]);
      const axis = m[2]!.toLowerCase() as 'x' | 'y' | 'z';
      let rawVal = m[3];
      if (!rawVal && next !== undefined) {
        rawVal = next;
        i++;
      }
      if (rawVal) {
        const expr = tryParseExpr(rawVal, line, warnings);
        if (expr) {
          node[axis] = expr;
          if (isInc) node.incremental[axis] = true;
        }
      }
      i++;
      continue;
    }

    warnings.push(`Line ${line}: unrecognized token "${tok}" in CR block`);
    i++;
  }

  return applyMotionTail(node, tail);
}

function parsePolarLinearMove(
  tokens: string[],
  line: number,
  warnings: string[],
): PolarLinearMoveNode {
  const node: PolarLinearMoveNode = {
    type: 'polar_linear',
    line,
    incrementalPr: false,
    incrementalPa: false,
  };
  const tail: MotionTail = { mCodes: [] };

  let i = 1;
  while (i < tokens.length) {
    const tok = tokens[i]!;
    const next = tokens[i + 1];

    const consumed = parseMotionTailToken(tok, next, tail, line, warnings);
    if (consumed > 0) {
      i += consumed;
      continue;
    }

    const prMatch = /^(I)?PR(.+)?$/i.exec(tok);
    if (prMatch) {
      const isInc = Boolean(prMatch[1]);
      let rawVal = prMatch[2];
      if (!rawVal && next !== undefined) {
        rawVal = next;
        i++;
      }
      if (rawVal) {
        const expr = tryParseExpr(rawVal, line, warnings);
        if (expr) {
          node.pr = expr;
          node.incrementalPr = isInc;
        }
      }
      i++;
      continue;
    }

    const paMatch = /^(I)?PA(.+)?$/i.exec(tok);
    if (paMatch) {
      const isInc = Boolean(paMatch[1]);
      let rawVal = paMatch[2];
      if (!rawVal && next !== undefined) {
        rawVal = next;
        i++;
      }
      if (rawVal) {
        const expr = tryParseExpr(rawVal, line, warnings);
        if (expr) {
          node.pa = expr;
          node.incrementalPa = isInc;
        }
      }
      i++;
      continue;
    }

    const zMatch = /^(I)?Z(.+)?$/i.exec(tok);
    if (zMatch) {
      const isInc = Boolean(zMatch[1]);
      let rawVal = zMatch[2];
      if (!rawVal && next !== undefined) {
        rawVal = next;
        i++;
      }
      if (rawVal) {
        const expr = tryParseExpr(rawVal, line, warnings);
        if (expr) {
          node.z = expr;
          node.incrementalZ = isInc;
        }
      }
      i++;
      continue;
    }

    warnings.push(`Line ${line}: unrecognized token "${tok}" in LP block`);
    i++;
  }

  return applyMotionTail(node, tail);
}

function parsePolarArcMove(tokens: string[], line: number, warnings: string[]): PolarArcMoveNode {
  const node: PolarArcMoveNode = {
    type: 'polar_arc',
    line,
    pa: { type: 'number', value: 0 },
    incrementalPa: false,
    dr: '+',
  };
  const tail: MotionTail = { mCodes: [] };

  let i = 1;
  while (i < tokens.length) {
    const tok = tokens[i]!;
    const next = tokens[i + 1];
    const upper = tok.toUpperCase();

    if (upper === 'DR+' || upper === 'DR-') {
      node.dr = upper[2] as ArcDirection;
      i++;
      continue;
    }

    const consumed = parseMotionTailToken(tok, next, tail, line, warnings);
    if (consumed > 0) {
      i += consumed;
      continue;
    }

    const paMatch = /^(I)?PA(.+)?$/i.exec(tok);
    if (paMatch) {
      const isInc = Boolean(paMatch[1]);
      let rawVal = paMatch[2];
      if (!rawVal && next !== undefined) {
        rawVal = next;
        i++;
      }
      if (rawVal) {
        const expr = tryParseExpr(rawVal, line, warnings);
        if (expr) {
          node.pa = expr;
          node.incrementalPa = isInc;
        }
      }
      i++;
      continue;
    }

    const zMatch = /^(I)?Z(.+)?$/i.exec(tok);
    if (zMatch) {
      const isInc = Boolean(zMatch[1]);
      let rawVal = zMatch[2];
      if (!rawVal && next !== undefined) {
        rawVal = next;
        i++;
      }
      if (rawVal) {
        const expr = tryParseExpr(rawVal, line, warnings);
        if (expr) {
          node.z = expr;
          node.incrementalZ = isInc;
        }
      }
      i++;
      continue;
    }

    warnings.push(`Line ${line}: unrecognized token "${tok}" in CP block`);
    i++;
  }

  return applyMotionTail(node, tail);
}

function parseFnStatement(
  body: string,
  line: number,
  warnings: string[],
): QParamAssignNode | FnConditionalGotoNode | undefined {
  const fnMatch = /^FN\s*(\d+)\s*:\s*(.+)$/i.exec(body);
  if (!fnMatch) {
    warnings.push(`Line ${line}: malformed FN statement "${body}"`);
    return undefined;
  }

  const fnNum = Number.parseInt(fnMatch[1]!, 10);
  const rest = fnMatch[2]!.trim();

  // FN 9..12: conditional GOTO
  if (fnNum >= 9 && fnNum <= 12) {
    const gotoMatch =
      /^IF\s+(.+?)\s+(EQU|EQ|=|NEQ|NE|!=|GT|>|LT|<)\s+(.+?)\s+GOTO\s+LBL\s+(.+)$/i.exec(rest);
    if (!gotoMatch) {
      warnings.push(`Line ${line}: malformed FN ${fnNum} conditional GOTO "${body}"`);
      return undefined;
    }
    const left = tryParseExpr(gotoMatch[1]!, line, warnings);
    const right = tryParseExpr(gotoMatch[3]!, line, warnings);
    if (!left || !right) return undefined;

    const opMap: Record<number, FnCompareOp> = {
      9: 'eq',
      10: 'ne',
      11: 'gt',
      12: 'lt',
    };

    return {
      type: 'fn_goto',
      line,
      fnNumber: fnNum as 9 | 10 | 11 | 12,
      op: opMap[fnNum]!,
      left,
      right,
      targetLabel: parseLabelRef(gotoMatch[4]!),
    };
  }

  // FN 0..8: Q-parameter math assignment
  const assignMatch = /^Q(\d+)\s*=\s*(.+)$/i.exec(rest);
  if (!assignMatch) {
    warnings.push(`Line ${line}: unsupported or malformed FN ${fnNum} statement "${body}"`);
    return undefined;
  }

  const target = Number.parseInt(assignMatch[1]!, 10);
  const rhs = assignMatch[2]!.trim();

  if (fnNum === 0) {
    const expr = tryParseExpr(rhs, line, warnings);
    if (!expr) return undefined;
    return { type: 'qparam_assign', line, target, fnNumber: 0, op: 'assign', expr };
  }

  if (fnNum === 1 || fnNum === 2 || fnNum === 3) {
    const opChar = fnNum === 1 ? '+' : fnNum === 2 ? '-' : '*';
    const opName: FnMathOp = fnNum === 1 ? 'add' : fnNum === 2 ? 'sub' : 'mul';
    // Split on operator surrounded by whitespace (handles unary signs like "+Q2 + +5")
    const re = new RegExp(`^(.+?)\\s+\\${opChar}\\s+(.+)$`);
    const parts = re.exec(rhs);
    if (parts) {
      const e1 = tryParseExpr(parts[1]!, line, warnings);
      const e2 = tryParseExpr(parts[2]!, line, warnings);
      if (e1 && e2) {
        return {
          type: 'qparam_assign',
          line,
          target,
          fnNumber: fnNum,
          op: opName,
          expr: e1,
          operand2: e2,
        };
      }
    }
    // Fallback: parse as general expression
    const expr = tryParseExpr(rhs, line, warnings);
    if (!expr) return undefined;
    return { type: 'qparam_assign', line, target, fnNumber: fnNum, op: 'assign', expr };
  }

  if (fnNum === 4) {
    const parts = /^(.+?)\s+(?:DIV|\/)\s+(.+)$/i.exec(rhs);
    if (parts) {
      const e1 = tryParseExpr(parts[1]!, line, warnings);
      const e2 = tryParseExpr(parts[2]!, line, warnings);
      if (e1 && e2) {
        return {
          type: 'qparam_assign',
          line,
          target,
          fnNumber: 4,
          op: 'div',
          expr: e1,
          operand2: e2,
        };
      }
    }
    warnings.push(`Line ${line}: malformed FN 4 DIV "${body}"`);
    return undefined;
  }

  if (fnNum === 5 || fnNum === 6 || fnNum === 7) {
    const kw = fnNum === 5 ? 'SQRT' : fnNum === 6 ? 'SIN' : 'COS';
    const opName: FnMathOp = fnNum === 5 ? 'sqrt' : fnNum === 6 ? 'sin' : 'cos';
    const re = new RegExp(`^(?:${kw}\\s+)?(.+)$`, 'i');
    const m = re.exec(rhs);
    if (m) {
      const expr = tryParseExpr(m[1]!, line, warnings);
      if (expr) {
        return { type: 'qparam_assign', line, target, fnNumber: fnNum, op: opName, expr };
      }
    }
    return undefined;
  }

  if (fnNum === 8) {
    const parts = /^(.+?)\s+LEN\s+(.+)$/i.exec(rhs);
    if (parts) {
      const e1 = tryParseExpr(parts[1]!, line, warnings);
      const e2 = tryParseExpr(parts[2]!, line, warnings);
      if (e1 && e2) {
        return {
          type: 'qparam_assign',
          line,
          target,
          fnNumber: 8,
          op: 'len',
          expr: e1,
          operand2: e2,
        };
      }
    }
    warnings.push(`Line ${line}: malformed FN 8 LEN "${body}"`);
    return undefined;
  }

  warnings.push(`Line ${line}: unsupported FN ${fnNum}`);
  return undefined;
}

/**
 * Applies a legacy `CYCL DEF <num>.<sub> ...` continuation line onto an active CyclDefNode.
 */
function applyLegacyCycleSubLine(
  cycle: CyclDefNode,
  subNum: number,
  rest: string,
  line: number,
  warnings: string[],
): void {
  const upper = rest.toUpperCase().trim();

  // CYCL DEF 7: Datum Shift (7.1 X+10 / 7.2 Y+20 / 7.3 Z+0 or all on 7.1)
  if (cycle.cycleNumber === 7) {
    cycle.datumShift ??= {};
    const tokens = splitBlockTokens(rest);
    for (const tok of tokens) {
      const m = /^([XYZ])(.+)$/i.exec(tok);
      if (m) {
        const axis = m[1]!.toLowerCase() as 'x' | 'y' | 'z';
        const expr = tryParseExpr(m[2]!, line, warnings);
        if (expr) cycle.datumShift[axis] = expr;
      }
    }
    return;
  }

  // CYCL DEF 8: Mirroring (8.1 X Y, or empty 8.1 to cancel)
  if (cycle.cycleNumber === 8) {
    const axes: AxisLetter[] = [];
    const tokens = splitBlockTokens(upper);
    for (const tok of tokens) {
      if (tok === 'X' || tok === 'Y' || tok === 'Z') {
        axes.push(tok);
      }
    }
    cycle.mirrorAxes = axes;
    return;
  }

  // CYCL DEF 10: Rotation (10.1 ROT+45 or 10.1 IROT+45)
  if (cycle.cycleNumber === 10) {
    const rotMatch = /^(I)?ROT\s*(.+)$/i.exec(rest.trim());
    if (rotMatch) {
      cycle.rotationIncremental = Boolean(rotMatch[1]);
      const expr = tryParseExpr(rotMatch[2]!, line, warnings);
      if (expr) cycle.rotationAngle = expr;
    } else if (rest.trim()) {
      const expr = tryParseExpr(rest.trim(), line, warnings);
      if (expr) cycle.rotationAngle = expr;
    }
    return;
  }

  // CYCL DEF 1: Pecking (1.1 SET UP, 1.2 DEPTH, 1.3 PLNGNG, 1.4 DWELL, 1.5 F)
  if (cycle.cycleNumber === 1) {
    const valMatch = /([+-]?(?:Q\d+|\d+(?:\.\d+)?))$/i.exec(rest.trim());
    if (valMatch) {
      const expr = tryParseExpr(valMatch[1]!, line, warnings);
      if (expr) {
        if (subNum === 1) cycle.params[200] = expr;
        else if (subNum === 2) cycle.params[201] = expr;
        else if (subNum === 3) cycle.params[202] = expr;
        else if (subNum === 4) cycle.params[211] = expr;
        else if (subNum === 5) cycle.params[206] = expr;
      }
    }
    return;
  }

  // CYCL DEF 4: Rectangular Pocket (4.1 SET UP, 4.2 DEPTH, 4.3 PLNGNG, 4.4 X, 4.5 Y, 4.6 F)
  if (cycle.cycleNumber === 4) {
    const valMatch = /([+-]?(?:Q\d+|\d+(?:\.\d+)?))/i.exec(
      rest.replace(/^(?:SET\s*UP|DEPTH|PLNGNG|X|Y|F)\s*/i, '').trim(),
    );
    if (valMatch) {
      const expr = tryParseExpr(valMatch[1]!, line, warnings);
      if (expr) {
        if (subNum === 1) cycle.params[200] = expr;
        else if (subNum === 2) cycle.params[201] = expr;
        else if (subNum === 3) cycle.params[202] = expr;
        else if (subNum === 4) cycle.params[218] = expr;
        else if (subNum === 5) cycle.params[219] = expr;
        else if (subNum === 6) cycle.params[207] = expr;
      }
    }
    return;
  }

  // CYCL DEF 5: Circular Pocket (5.1 SET UP, 5.2 DEPTH, 5.3 PLNGNG, 5.4 RADIUS, 5.5 F)
  if (cycle.cycleNumber === 5) {
    const valMatch = /([+-]?(?:Q\d+|\d+(?:\.\d+)?))/i.exec(
      rest.replace(/^(?:SET\s*UP|DEPTH|PLNGNG|RADIUS|R|F)\s*/i, '').trim(),
    );
    if (valMatch) {
      const expr = tryParseExpr(valMatch[1]!, line, warnings);
      if (expr) {
        if (subNum === 1) cycle.params[200] = expr;
        else if (subNum === 2) cycle.params[201] = expr;
        else if (subNum === 3) cycle.params[202] = expr;
        else if (subNum === 4) {
          // Store diameter in Q223 = 2 * radius
          cycle.params[223] = {
            type: 'binary',
            op: '*',
            left: expr,
            right: { type: 'number', value: 2 },
          };
        } else if (subNum === 5) cycle.params[207] = expr;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

/**
 * Parses Heidenhain Klartext (.h / .H) source text into a typed AST.
 */
export function parseHeidenhainToAst(source: string): HeidenhainProgram {
  const rawLines = source.split(/\r?\n/);
  const statements: HeidenhainStatement[] = [];
  const warnings: string[] = [];

  let programName = 'UNTITLED';
  let programUnits: HeidenhainUnit = 'mm';
  let activeCyclDef: CyclDefNode | null = null;

  for (let idx = 0; idx < rawLines.length; idx++) {
    const lineNum = idx + 1;
    const noComment = stripComment(rawLines[idx]!);
    const body = stripBlockNumber(noComment);
    if (!body) {
      continue;
    }

    // Check if this is a Q-parameter continuation line for an active CYCL DEF
    if (activeCyclDef) {
      // Legacy sub-line: e.g., "CYCL DEF 7.1 X+10" or "CYCL DEF 1.1 SET UP 2"
      const legacySub = /^CYCL\s+DEF\s+(\d+)\.(\d+)\s*(.*)$/i.exec(body);
      if (legacySub) {
        const cNum = Number.parseInt(legacySub[1]!, 10);
        const subNum = Number.parseInt(legacySub[2]!, 10);
        if (cNum === activeCyclDef.cycleNumber && subNum > 0) {
          applyLegacyCycleSubLine(activeCyclDef, subNum, legacySub[3] ?? '', lineNum, warnings);
          continue;
        }
      }

      // Modern Q-param line directly following CYCL DEF (e.g. "Q200=+2", "Q201=-20")
      // Note: Heidenhain cycle params are Q200+ (or Q3xx/Q4xx) and have no spaces around '='
      // or appear immediately after CYCL DEF.
      const qCont = /^Q(\d+)\s*=\s*(.+)$/i.exec(body);
      if (qCont && activeCyclDef.cycleNumber >= 100) {
        const qNum = Number.parseInt(qCont[1]!, 10);
        const expr = tryParseExpr(qCont[2]!, lineNum, warnings);
        if (expr) {
          activeCyclDef.params[qNum] = expr;
        }
        continue;
      }

      // Any non-continuation line closes the active CYCL DEF
      activeCyclDef = null;
    }

    // BEGIN PGM <name> MM|INCH
    const beginMatch = /^BEGIN\s+PGM\s+(.+?)\s+(MM|INCH|IN)\s*$/i.exec(body);
    if (beginMatch) {
      programName = beginMatch[1]!.trim();
      programUnits = parseUnits(beginMatch[2]);
      const node: BeginPgmNode = {
        type: 'begin_pgm',
        line: lineNum,
        name: programName,
        units: programUnits,
      };
      statements.push(node);
      continue;
    }

    // END PGM <name> MM|INCH
    const endMatch = /^END\s+PGM\s+(.+?)\s+(MM|INCH|IN)\s*$/i.exec(body);
    if (endMatch) {
      const node: EndPgmNode = {
        type: 'end_pgm',
        line: lineNum,
        name: endMatch[1]!.trim(),
        units: parseUnits(endMatch[2]),
      };
      statements.push(node);
      continue;
    }

    // BLK FORM 0.1 [Z] X... Y... Z...  /  BLK FORM 0.2 X... Y... Z...
    const blkMatch = /^BLK\s+FORM\s+0\.([12])\s+(.+)$/i.exec(body);
    if (blkMatch) {
      const point = Number.parseInt(blkMatch[1]!, 10) as 1 | 2;
      const tokens = splitBlockTokens(blkMatch[2]!);
      let axis: AxisLetter | undefined;
      let x: HeidenhainExpr = { type: 'number', value: 0 };
      let y: HeidenhainExpr = { type: 'number', value: 0 };
      let z: HeidenhainExpr = { type: 'number', value: 0 };

      for (const tok of tokens) {
        const upper = tok.toUpperCase();
        if (upper === 'X' || upper === 'Y' || upper === 'Z') {
          axis = upper;
          continue;
        }
        const m = /^([XYZ])(.+)$/i.exec(tok);
        if (m) {
          const expr = tryParseExpr(m[2]!, lineNum, warnings);
          if (expr) {
            const a = m[1]!.toUpperCase();
            if (a === 'X') x = expr;
            else if (a === 'Y') y = expr;
            else if (a === 'Z') z = expr;
          }
        }
      }

      const node: BlkFormNode = {
        type: 'blk_form',
        line: lineNum,
        point,
        ...(axis ? { axis } : {}),
        x,
        y,
        z,
      };
      statements.push(node);
      continue;
    }

    // TOOL CALL <tool> [X|Y|Z] [S<rpm>] [F<feed>] [DL<v>] [DR<v>]
    if (/^TOOL\s+CALL\b/i.test(body)) {
      const rest = body.replace(/^TOOL\s+CALL\s*/i, '');
      const tokens = splitBlockTokens(rest);
      let tool: number | string = 0;
      let axis: AxisLetter = 'Z';
      let spindleSpeed: HeidenhainExpr | undefined;
      let feedRate: HeidenhainExpr | undefined;
      let dl: HeidenhainExpr | undefined;
      let dr: HeidenhainExpr | undefined;

      let i = 0;
      if (tokens[0] !== undefined) {
        const t0 = tokens[0];
        if (t0.startsWith('"') && t0.endsWith('"')) {
          tool = t0.slice(1, -1);
        } else if (/^\d+$/.test(t0)) {
          tool = Number.parseInt(t0, 10);
        } else if (!/^[XYZ]$|^S|^F|^DL|^DR/i.test(t0)) {
          tool = t0;
        } else {
          i = -1; // no tool token before axis
        }
        i++;
      }

      for (; i < tokens.length; i++) {
        const tok = tokens[i]!;
        const upper = tok.toUpperCase();
        if (upper === 'X' || upper === 'Y' || upper === 'Z') {
          axis = upper;
        } else if (upper.startsWith('S') && tok.length > 1) {
          spindleSpeed = tryParseExpr(tok.slice(1), lineNum, warnings);
        } else if (upper === 'S' && tokens[i + 1]) {
          spindleSpeed = tryParseExpr(tokens[++i]!, lineNum, warnings);
        } else if (upper.startsWith('F') && tok.length > 1) {
          feedRate = tryParseExpr(tok.slice(1), lineNum, warnings);
        } else if (upper === 'F' && tokens[i + 1]) {
          feedRate = tryParseExpr(tokens[++i]!, lineNum, warnings);
        } else if (upper.startsWith('DL') && tok.length > 2) {
          dl = tryParseExpr(tok.slice(2), lineNum, warnings);
        } else if (upper.startsWith('DR') && tok.length > 2) {
          dr = tryParseExpr(tok.slice(2), lineNum, warnings);
        }
      }

      const node: ToolCallNode = {
        type: 'tool_call',
        line: lineNum,
        tool,
        axis,
        ...(spindleSpeed ? { spindleSpeed } : {}),
        ...(feedRate ? { feedRate } : {}),
        ...(dl ? { dl } : {}),
        ...(dr ? { dr } : {}),
      };
      statements.push(node);
      continue;
    }

    // TOOL DEF (informational, no motion)
    if (/^TOOL\s+DEF\b/i.test(body)) {
      continue;
    }

    // CYCL DEF <num>[.0] <name>
    const cyclDefMatch = /^CYCL\s+DEF\s+(\d+)(?:\.(\d+))?\s*(.*)$/i.exec(body);
    if (cyclDefMatch) {
      const cycleNumber = Number.parseInt(cyclDefMatch[1]!, 10);
      const subNum = cyclDefMatch[2] !== undefined ? Number.parseInt(cyclDefMatch[2], 10) : 0;
      const name = (cyclDefMatch[3] ?? '').trim();

      if (subNum === 0) {
        const node: CyclDefNode = {
          type: 'cycl_def',
          line: lineNum,
          cycleNumber,
          name,
          params: {},
        };
        // Check for inline parameters on CYCL DEF 7 / 8 / 10 (e.g. "CYCL DEF 7 DATUM SHIFT X+10 Y+20")
        if (cycleNumber === 7 && /\b[XYZ][+-]?(?:Q\d+|\d)/i.test(name)) {
          applyLegacyCycleSubLine(node, 1, name, lineNum, warnings);
        } else if (cycleNumber === 10 && /\bI?ROT\s*[+-]?(?:Q\d+|\d)/i.test(name)) {
          const rotPart = /\b(I?ROT\s*[+-]?(?:Q\d+|\d+(?:\.\d+)?))/i.exec(name);
          if (rotPart) applyLegacyCycleSubLine(node, 1, rotPart[1]!, lineNum, warnings);
        }
        statements.push(node);
        activeCyclDef = node;
      } else {
        // Standalone sub-line without .0 header
        const prev = statements[statements.length - 1];
        if (prev && prev.type === 'cycl_def' && prev.cycleNumber === cycleNumber) {
          applyLegacyCycleSubLine(prev, subNum, name, lineNum, warnings);
          activeCyclDef = prev;
        } else {
          const node: CyclDefNode = {
            type: 'cycl_def',
            line: lineNum,
            cycleNumber,
            name: '',
            params: {},
          };
          applyLegacyCycleSubLine(node, subNum, name, lineNum, warnings);
          statements.push(node);
          activeCyclDef = node;
        }
      }
      continue;
    }

    // CYCL CALL [POS|PAT] [M<code>]
    if (/^CYCL\s+CALL\b/i.test(body)) {
      const rest = body.replace(/^CYCL\s+CALL\s*/i, '').trim();
      const tokens = splitBlockTokens(rest);
      let mode: 'CALL' | 'POS' | 'PAT' = 'CALL';
      const mCodes: number[] = [];

      for (const tok of tokens) {
        const upper = tok.toUpperCase();
        if (upper === 'POS') mode = 'POS';
        else if (upper === 'PAT') mode = 'PAT';
        else if (/^M\d+$/i.test(tok)) {
          mCodes.push(Number.parseInt(tok.slice(1), 10));
        }
      }

      const node: CyclCallNode = {
        type: 'cycl_call',
        line: lineNum,
        mode,
        ...(mCodes.length > 0 ? { mCode: mCodes[0], mCodes } : {}),
      };
      statements.push(node);
      continue;
    }

    // LBL <n>
    const lblMatch = /^LBL\s+(.+)$/i.exec(body);
    if (lblMatch) {
      const node: LabelDefNode = {
        type: 'label_def',
        line: lineNum,
        label: parseLabelRef(lblMatch[1]!),
      };
      statements.push(node);
      continue;
    }

    // CALL LBL <n> [REP <m>]
    const callLblMatch = /^CALL\s+LBL\s+(\S+)(?:\s+REP(?:\s+(.+))?)?$/i.exec(body);
    if (callLblMatch) {
      const label = parseLabelRef(callLblMatch[1]!);
      let repeat: HeidenhainExpr | undefined;
      if (callLblMatch[2] !== undefined && callLblMatch[2].trim()) {
        repeat = tryParseExpr(callLblMatch[2], lineNum, warnings);
      }
      const node: CallLabelNode = {
        type: 'call_label',
        line: lineNum,
        label,
        ...(repeat ? { repeat } : {}),
      };
      statements.push(node);
      continue;
    }

    // FN 0..12
    if (/^FN\s*\d+\s*:/i.test(body)) {
      const fnNode = parseFnStatement(body, lineNum, warnings);
      if (fnNode) statements.push(fnNode);
      continue;
    }

    // Direct Q-parameter assignment: Q<n> = <expr>
    const qAssignMatch = /^Q(\d+)\s*=\s*(.+)$/i.exec(body);
    if (qAssignMatch) {
      const target = Number.parseInt(qAssignMatch[1]!, 10);
      const expr = tryParseExpr(qAssignMatch[2]!, lineNum, warnings);
      if (expr) {
        const node: QParamAssignNode = {
          type: 'qparam_assign',
          line: lineNum,
          target,
          op: 'assign',
          expr,
        };
        statements.push(node);
      }
      continue;
    }

    // Motion & M-code blocks
    const tokens = splitBlockTokens(body);
    const cmd = tokens[0]?.toUpperCase();

    if (cmd === 'L') {
      statements.push(parseLinearMove(tokens, lineNum, warnings));
      continue;
    }
    if (cmd === 'CC') {
      statements.push(parseCircleCenter(tokens, lineNum, warnings));
      continue;
    }
    if (cmd === 'C') {
      statements.push(parseArcMove(tokens, lineNum, warnings));
      continue;
    }
    if (cmd === 'CR') {
      statements.push(parseArcRadiusMove(tokens, lineNum, warnings));
      continue;
    }
    if (cmd === 'LP') {
      statements.push(parsePolarLinearMove(tokens, lineNum, warnings));
      continue;
    }
    if (cmd === 'CP') {
      statements.push(parsePolarArcMove(tokens, lineNum, warnings));
      continue;
    }

    // Standalone M-code(s)
    if (cmd && /^M\d+$/i.test(cmd)) {
      for (const tok of tokens) {
        if (/^M\d+$/i.test(tok)) {
          const node: MCodeNode = {
            type: 'm_code',
            line: lineNum,
            code: Number.parseInt(tok.slice(1), 10),
          };
          statements.push(node);
        }
      }
      continue;
    }

    // Ignore pure comments / * section markers
    if (body.startsWith('*')) {
      continue;
    }

    warnings.push(`Line ${lineNum}: unrecognized Klartext statement "${body}"`);
  }

  return {
    name: programName,
    units: programUnits,
    statements,
    warnings,
  };
}
