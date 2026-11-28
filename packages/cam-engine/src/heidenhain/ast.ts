/**
 * Heidenhain Klartext (.h / .H) Abstract Syntax Tree (AST) definitions.
 * Zero UI/DOM dependencies — runs cleanly in Node.js and Web Workers.
 */

export type HeidenhainUnit = 'mm' | 'in';

export type RadiusComp = 'R0' | 'RL' | 'RR';

export type ArcDirection = '+' | '-';

export type AxisLetter = 'X' | 'Y' | 'Z';

export type HeidenhainExpr =
  | { type: 'number'; value: number }
  | { type: 'qparam'; index: number }
  | { type: 'unary'; op: '+' | '-'; operand: HeidenhainExpr }
  | {
      type: 'binary';
      op: '+' | '-' | '*' | '/';
      left: HeidenhainExpr;
      right: HeidenhainExpr;
    };

export interface BeginPgmNode {
  type: 'begin_pgm';
  line: number;
  name: string;
  units: HeidenhainUnit;
}

export interface EndPgmNode {
  type: 'end_pgm';
  line: number;
  name: string;
  units: HeidenhainUnit;
}

export interface BlkFormNode {
  type: 'blk_form';
  line: number;
  point: 1 | 2;
  axis?: AxisLetter;
  x: HeidenhainExpr;
  y: HeidenhainExpr;
  z: HeidenhainExpr;
}

export interface ToolCallNode {
  type: 'tool_call';
  line: number;
  tool: number | string;
  axis: AxisLetter;
  spindleSpeed?: HeidenhainExpr;
  feedRate?: HeidenhainExpr;
  dl?: HeidenhainExpr;
  dr?: HeidenhainExpr;
}

export interface LinearIncrementalFlags {
  x?: boolean;
  y?: boolean;
  z?: boolean;
  a?: boolean;
  b?: boolean;
  c?: boolean;
}

export interface LinearMoveNode {
  type: 'linear';
  line: number;
  x?: HeidenhainExpr;
  y?: HeidenhainExpr;
  z?: HeidenhainExpr;
  a?: HeidenhainExpr;
  b?: HeidenhainExpr;
  c?: HeidenhainExpr;
  incremental: LinearIncrementalFlags;
  comp?: RadiusComp;
  fMax?: boolean;
  fAuto?: boolean;
  feedRate?: HeidenhainExpr;
  mCode?: number;
  mCodes?: number[];
}

export interface CircleCenterNode {
  type: 'circle_center';
  line: number;
  x?: HeidenhainExpr;
  y?: HeidenhainExpr;
  incremental: {
    x?: boolean;
    y?: boolean;
  };
}

export interface ArcMoveNode {
  type: 'arc';
  line: number;
  x?: HeidenhainExpr;
  y?: HeidenhainExpr;
  z?: HeidenhainExpr;
  incremental: {
    x?: boolean;
    y?: boolean;
    z?: boolean;
  };
  dr: ArcDirection;
  comp?: RadiusComp;
  fMax?: boolean;
  fAuto?: boolean;
  feedRate?: HeidenhainExpr;
  mCode?: number;
  mCodes?: number[];
}

export interface ArcRadiusMoveNode {
  type: 'arc_radius';
  line: number;
  x?: HeidenhainExpr;
  y?: HeidenhainExpr;
  z?: HeidenhainExpr;
  incremental: {
    x?: boolean;
    y?: boolean;
    z?: boolean;
  };
  radius: HeidenhainExpr;
  dr: ArcDirection;
  comp?: RadiusComp;
  fMax?: boolean;
  fAuto?: boolean;
  feedRate?: HeidenhainExpr;
  mCode?: number;
  mCodes?: number[];
}

export interface PolarLinearMoveNode {
  type: 'polar_linear';
  line: number;
  pr?: HeidenhainExpr;
  pa?: HeidenhainExpr;
  incrementalPr: boolean;
  incrementalPa: boolean;
  z?: HeidenhainExpr;
  incrementalZ?: boolean;
  fMax?: boolean;
  fAuto?: boolean;
  feedRate?: HeidenhainExpr;
  comp?: RadiusComp;
  mCode?: number;
  mCodes?: number[];
}

export interface PolarArcMoveNode {
  type: 'polar_arc';
  line: number;
  pa: HeidenhainExpr;
  incrementalPa: boolean;
  dr: ArcDirection;
  z?: HeidenhainExpr;
  incrementalZ?: boolean;
  fMax?: boolean;
  fAuto?: boolean;
  feedRate?: HeidenhainExpr;
  comp?: RadiusComp;
  mCode?: number;
  mCodes?: number[];
}

export interface LabelDefNode {
  type: 'label_def';
  line: number;
  /** Label identifier; 0 denotes end of subroutine (LBL 0). */
  label: number | string;
}

export interface CallLabelNode {
  type: 'call_label';
  line: number;
  label: number | string;
  /** Optional REP count. Note: REP m means m + 1 total executions. */
  repeat?: HeidenhainExpr;
}

export type FnMathOp =
  | 'assign'
  | 'add'
  | 'sub'
  | 'mul'
  | 'div'
  | 'sqrt'
  | 'sin'
  | 'cos'
  | 'len';

export interface QParamAssignNode {
  type: 'qparam_assign';
  line: number;
  target: number;
  fnNumber?: number;
  op: FnMathOp;
  expr: HeidenhainExpr;
  operand2?: HeidenhainExpr;
}

export type FnCompareOp = 'eq' | 'ne' | 'gt' | 'lt';

export interface FnConditionalGotoNode {
  type: 'fn_goto';
  line: number;
  fnNumber: 9 | 10 | 11 | 12;
  op: FnCompareOp;
  left: HeidenhainExpr;
  right: HeidenhainExpr;
  targetLabel: number | string;
}

export interface CyclDefNode {
  type: 'cycl_def';
  line: number;
  cycleNumber: number;
  name: string;
  params: Record<number, HeidenhainExpr>;
  datumShift?: {
    x?: HeidenhainExpr;
    y?: HeidenhainExpr;
    z?: HeidenhainExpr;
  };
  mirrorAxes?: AxisLetter[];
  rotationAngle?: HeidenhainExpr;
  rotationIncremental?: boolean;
}

export interface CyclCallNode {
  type: 'cycl_call';
  line: number;
  mode?: 'CALL' | 'POS' | 'PAT';
  mCode?: number;
  mCodes?: number[];
}

export interface MCodeNode {
  type: 'm_code';
  line: number;
  code: number;
}

export type HeidenhainStatement =
  | BeginPgmNode
  | EndPgmNode
  | BlkFormNode
  | ToolCallNode
  | LinearMoveNode
  | CircleCenterNode
  | ArcMoveNode
  | ArcRadiusMoveNode
  | PolarLinearMoveNode
  | PolarArcMoveNode
  | LabelDefNode
  | CallLabelNode
  | QParamAssignNode
  | FnConditionalGotoNode
  | CyclDefNode
  | CyclCallNode
  | MCodeNode;

export interface HeidenhainProgram {
  name: string;
  units: HeidenhainUnit;
  statements: HeidenhainStatement[];
  warnings: string[];
}
