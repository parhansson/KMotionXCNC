import {
  computeBounds,
  type IgmDocument,
  type IgmLayer,
  type IgmSegment,
  type LineSegment,
} from '@kmxcnc/igm';
import type * as OpenType from 'opentype.js';

/** PDF user-space points (1/72 in) to canonical mm. */
const PT_TO_MM = 25.4 / 72;

export type Mat6 = [number, number, number, number, number, number];

export interface PdfFontSource {
  /** Font display name reported by PDF.js (e.g. "Helvetica", "g_d0_f1"). */
  name: string;
  /** Raw SFNT/TTF/OTF font bytes extracted from `page.commonObjs`, if embedded. */
  data?: Uint8Array | ArrayBuffer | null;
}

export interface PdfParseOptions {
  /** 1-based page number to import (default: 1). */
  pageNumber?: number;
  /** Additional rotation in degrees (0, 90, 180, 270; default: 0). */
  rotation?: 0 | 90 | 180 | 270;
  /** Uniform scale multiplier applied after pt -> mm conversion (default: 1). */
  scale?: number;
  /** Chord tolerance in mm when flattening cubic/quadratic Bézier curves (default: 0.1). */
  curveToleranceMm?: number;
  /** Whether to extract OPS.showText into a separate optional "PDF Text" layer (default: true). */
  includeText?: boolean;
  /** Initial visibility of the "PDF Text" layer when `includeText` is true (default: true). */
  textLayerVisible?: boolean;
  /** Optional fallback TTF/OTF font bytes for non-embedded PDF fonts (e.g. Base-14 Helvetica/Times). */
  fallbackFontBuffer?: ArrayBuffer | Uint8Array | null;
  /** Optional async font loader (e.g. fetching from machine root `settings/fonts/` via FileStorage). */
  loadFont?: (fontName: string) => Promise<ArrayBuffer | Uint8Array | null>;
}

export interface PdfImportResult {
  doc: IgmDocument;
  pageCount: number;
  pageNumber: number;
  textGlyphCount: number;
  fontsUsed: string[];
  warnings: string[];
}

export interface PdfOperatorListLike {
  fnArray: number[];
  argsArray: unknown[];
}

export interface PdfOpsMap {
  save: number;
  restore: number;
  transform: number;
  constructPath: number;
  moveTo: number;
  lineTo: number;
  curveTo: number;
  curveTo2: number;
  curveTo3: number;
  closePath: number;
  rectangle: number;
  stroke: number;
  closeStroke: number;
  fill: number;
  eoFill: number;
  fillStroke: number;
  eoFillStroke: number;
  closeFillStroke: number;
  closeEOFillStroke: number;
  endPath: number;
  setStrokeRGBColor: number;
  setStrokeGray: number;
  setStrokeCMYKColor: number;
  setFillRGBColor: number;
  setFillGray: number;
  setFillCMYKColor: number;
  beginText: number;
  endText: number;
  setCharSpacing: number;
  setWordSpacing: number;
  setHScale: number;
  setLeading: number;
  setFont: number;
  setTextRise: number;
  moveText: number;
  setLeadingMoveText: number;
  setTextMatrix: number;
  nextLine: number;
  showText: number;
  showSpacedText: number;
}

/** Standard pdfjs-dist v4 OPS constants (used as default for pure `operatorListToIgm`). */
export const DEFAULT_PDF_OPS: PdfOpsMap = {
  save: 10,
  restore: 11,
  transform: 12,
  moveTo: 13,
  lineTo: 14,
  curveTo: 15,
  curveTo2: 16,
  curveTo3: 17,
  closePath: 18,
  rectangle: 19,
  stroke: 20,
  closeStroke: 21,
  fill: 22,
  eoFill: 23,
  fillStroke: 24,
  eoFillStroke: 25,
  closeFillStroke: 26,
  closeEOFillStroke: 27,
  endPath: 28,
  beginText: 31,
  endText: 32,
  setCharSpacing: 33,
  setWordSpacing: 34,
  setHScale: 35,
  setLeading: 36,
  setFont: 37,
  setTextRise: 39,
  moveText: 40,
  setLeadingMoveText: 41,
  setTextMatrix: 42,
  nextLine: 43,
  showText: 44,
  showSpacedText: 45,
  setStrokeGray: 56,
  setFillGray: 57,
  setStrokeRGBColor: 58,
  setFillRGBColor: 59,
  setStrokeCMYKColor: 60,
  setFillCMYKColor: 61,
  constructPath: 91,
};

interface GraphicsState {
  ctm: Mat6;
  strokeColor: string;
  fillColor: string;
  charSpacing: number;
  wordSpacing: number;
  hScale: number;
  leading: number;
  textRise: number;
  fontName: string;
  fontSize: number;
}

interface Pt2 {
  x: number;
  y: number;
}

function multiplyMat6(m1: Mat6, m2: Mat6): Mat6 {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

function applyMat6(m: Mat6, x: number, y: number): Pt2 {
  return {
    x: m[0] * x + m[2] * y + m[4],
    y: m[1] * x + m[3] * y + m[5],
  };
}

function clampByte(n: number): number {
  if (!Number.isFinite(n)) return 0;
  // pdfjs-dist v4 may pass 0..255 ints OR 0..1 floats depending on operator/version
  const scaled = n > 1 ? n : n * 255;
  return Math.max(0, Math.min(255, Math.round(scaled)));
}

function rgbToHex(r: number, g: number, b: number): string {
  const hr = clampByte(r).toString(16).padStart(2, '0');
  const hg = clampByte(g).toString(16).padStart(2, '0');
  const hb = clampByte(b).toString(16).padStart(2, '0');
  return `#${hr}${hg}${hb}`;
}

function cmykToHex(c: number, m: number, y: number, k: number): string {
  const r = (1 - c) * (1 - k);
  const g = (1 - m) * (1 - k);
  const b = (1 - y) * (1 - k);
  return rgbToHex(r, g, b);
}

function parseColorArg(args: unknown[], kind: 'rgb' | 'gray' | 'cmyk'): string {
  if (kind === 'rgb') {
    if (args.length === 1 && typeof args[0] === 'string' && args[0].startsWith('#')) {
      return args[0].toLowerCase();
    }
    const vals =
      args.length === 1 && (Array.isArray(args[0]) || ArrayBuffer.isView(args[0]))
        ? Array.from(args[0] as ArrayLike<number>)
        : (args as number[]);
    return rgbToHex(vals[0] ?? 0, vals[1] ?? 0, vals[2] ?? 0);
  }
  if (kind === 'gray') {
    const g = Number(args[0] ?? 0);
    return rgbToHex(g, g, g);
  }
  return cmykToHex(
    Number(args[0] ?? 0),
    Number(args[1] ?? 0),
    Number(args[2] ?? 0),
    Number(args[3] ?? 0),
  );
}

function flattenCubic(
  p0: Pt2,
  p1: Pt2,
  p2: Pt2,
  p3: Pt2,
  tol: number,
  out: Pt2[],
  depth = 0,
): void {
  const dx = p3.x - p0.x;
  const dy = p3.y - p0.y;
  const lenSq = dx * dx + dy * dy;
  let d1: number;
  let d2: number;
  if (lenSq < 1e-12) {
    d1 = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    d2 = Math.hypot(p2.x - p0.x, p2.y - p0.y);
  } else {
    const invLen = 1 / Math.sqrt(lenSq);
    d1 = Math.abs((p1.x - p0.x) * dy - (p1.y - p0.y) * dx) * invLen;
    d2 = Math.abs((p2.x - p0.x) * dy - (p2.y - p0.y) * dx) * invLen;
  }

  if ((d1 <= tol && d2 <= tol) || depth >= 10) {
    out.push(p3);
    return;
  }

  const p01 = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
  const p12 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  const p23 = { x: (p2.x + p3.x) / 2, y: (p2.y + p3.y) / 2 };
  const p012 = { x: (p01.x + p12.x) / 2, y: (p01.y + p12.y) / 2 };
  const p123 = { x: (p12.x + p23.x) / 2, y: (p12.y + p23.y) / 2 };
  const mid = { x: (p012.x + p123.x) / 2, y: (p012.y + p123.y) / 2 };

  flattenCubic(p0, p01, p012, mid, tol, out, depth + 1);
  flattenCubic(mid, p123, p23, p3, tol, out, depth + 1);
}

function flattenQuad(
  p0: Pt2,
  p1: Pt2,
  p2: Pt2,
  tol: number,
  out: Pt2[],
  depth = 0,
): void {
  const c1 = { x: p0.x + (2 / 3) * (p1.x - p0.x), y: p0.y + (2 / 3) * (p1.y - p0.y) };
  const c2 = { x: p2.x + (2 / 3) * (p1.x - p2.x), y: p2.y + (2 / 3) * (p1.y - p2.y) };
  flattenCubic(p0, c1, c2, p2, tol, out, depth);
}

/**
 * Minimal single-line vector stroke glyphs (normalized 0..1 width, 0..1 cap height, Y-up)
 * used as a clean CNC/laser-friendly fallback when a PDF uses non-embedded Base-14 fonts
 * and no external TTF/OTF fallback font is supplied.
 */
const STROKE_FONT: Record<string, Array<Array<[number, number]>>> = {
  A: [[[0, 0], [0.4, 1], [0.8, 0]], [[0.16, 0.35], [0.64, 0.35]]],
  B: [[[0, 0], [0, 1], [0.55, 1], [0.7, 0.85], [0.7, 0.6], [0.55, 0.5], [0, 0.5]], [[0.55, 0.5], [0.75, 0.4], [0.75, 0.15], [0.55, 0], [0, 0]]],
  C: [[[0.75, 0.85], [0.55, 1], [0.2, 1], [0, 0.8], [0, 0.2], [0.2, 0], [0.55, 0], [0.75, 0.15]]],
  D: [[[0, 0], [0, 1], [0.5, 1], [0.75, 0.75], [0.75, 0.25], [0.5, 0], [0, 0]]],
  E: [[[0.7, 1], [0, 1], [0, 0], [0.7, 0]], [[0, 0.5], [0.55, 0.5]]],
  F: [[[0.7, 1], [0, 1], [0, 0]], [[0, 0.5], [0.55, 0.5]]],
  G: [[[0.75, 0.85], [0.55, 1], [0.2, 1], [0, 0.8], [0, 0.2], [0.2, 0], [0.55, 0], [0.75, 0.2], [0.75, 0.45], [0.45, 0.45]]],
  H: [[[0, 0], [0, 1]], [[0.75, 0], [0.75, 1]], [[0, 0.5], [0.75, 0.5]]],
  I: [[[0.15, 1], [0.55, 1]], [[0.35, 1], [0.35, 0]], [[0.15, 0], [0.55, 0]]],
  J: [[[0.65, 1], [0.65, 0.2], [0.45, 0], [0.2, 0], [0, 0.2]]],
  K: [[[0, 0], [0, 1]], [[0.75, 1], [0, 0.45], [0.75, 0]]],
  L: [[[0, 1], [0, 0], [0.7, 0]]],
  M: [[[0, 0], [0, 1], [0.4, 0.4], [0.8, 1], [0.8, 0]]],
  N: [[[0, 0], [0, 1], [0.75, 0], [0.75, 1]]],
  O: [[[0.2, 1], [0.55, 1], [0.75, 0.8], [0.75, 0.2], [0.55, 0], [0.2, 0], [0, 0.2], [0, 0.8], [0.2, 1]]],
  P: [[[0, 0], [0, 1], [0.55, 1], [0.75, 0.85], [0.75, 0.6], [0.55, 0.45], [0, 0.45]]],
  Q: [[[0.2, 1], [0.55, 1], [0.75, 0.8], [0.75, 0.2], [0.55, 0], [0.2, 0], [0, 0.2], [0, 0.8], [0.2, 1]], [[0.45, 0.25], [0.8, -0.05]]],
  R: [[[0, 0], [0, 1], [0.55, 1], [0.75, 0.85], [0.75, 0.6], [0.55, 0.45], [0, 0.45]], [[0.4, 0.45], [0.75, 0]]],
  S: [[[0.75, 0.85], [0.55, 1], [0.2, 1], [0, 0.85], [0, 0.65], [0.2, 0.52], [0.55, 0.48], [0.75, 0.35], [0.75, 0.15], [0.55, 0], [0.2, 0], [0, 0.15]]],
  T: [[[0, 1], [0.75, 1]], [[0.375, 1], [0.375, 0]]],
  U: [[[0, 1], [0, 0.2], [0.2, 0], [0.55, 0], [0.75, 0.2], [0.75, 1]]],
  V: [[[0, 1], [0.375, 0], [0.75, 1]]],
  W: [[[0, 1], [0.2, 0], [0.4, 0.6], [0.6, 0], [0.8, 1]]],
  X: [[[0, 1], [0.75, 0]], [[0.75, 1], [0, 0]]],
  Y: [[[0, 1], [0.375, 0.5], [0.75, 1]], [[0.375, 0.5], [0.375, 0]]],
  Z: [[[0, 1], [0.75, 1], [0, 0], [0.75, 0]]],
  '0': [[[0.2, 1], [0.55, 1], [0.75, 0.8], [0.75, 0.2], [0.55, 0], [0.2, 0], [0, 0.2], [0, 0.8], [0.2, 1]], [[0.15, 0.15], [0.6, 0.85]]],
  '1': [[[0.15, 0.8], [0.4, 1], [0.4, 0]], [[0.15, 0], [0.65, 0]]],
  '2': [[[0, 0.8], [0.2, 1], [0.55, 1], [0.75, 0.8], [0.75, 0.6], [0, 0], [0.75, 0]]],
  '3': [[[0, 0.85], [0.2, 1], [0.55, 1], [0.75, 0.82], [0.75, 0.62], [0.5, 0.5], [0.25, 0.5]], [[0.5, 0.5], [0.75, 0.38], [0.75, 0.18], [0.55, 0], [0.2, 0], [0, 0.15]]],
  '4': [[[0.55, 0], [0.55, 1], [0, 0.35], [0.75, 0.35]]],
  '5': [[[0.7, 1], [0.05, 1], [0, 0.55], [0.55, 0.55], [0.75, 0.4], [0.75, 0.18], [0.55, 0], [0.2, 0], [0, 0.15]]],
  '6': [[[0.7, 0.88], [0.5, 1], [0.2, 1], [0, 0.75], [0, 0.2], [0.2, 0], [0.55, 0], [0.75, 0.2], [0.75, 0.42], [0.55, 0.58], [0, 0.58]]],
  '7': [[[0, 1], [0.75, 1], [0.25, 0]]],
  '8': [[[0.2, 0.5], [0, 0.65], [0, 0.85], [0.2, 1], [0.55, 1], [0.75, 0.85], [0.75, 0.65], [0.55, 0.5], [0.2, 0.5], [0, 0.35], [0, 0.15], [0.2, 0], [0.55, 0], [0.75, 0.15], [0.75, 0.35], [0.55, 0.5]]],
  '9': [[[0.75, 0.45], [0.2, 0.45], [0, 0.62], [0, 0.82], [0.2, 1], [0.55, 1], [0.75, 0.8], [0.75, 0.2], [0.55, 0], [0.15, 0]]],
  '-': [[[0.1, 0.5], [0.6, 0.5]]],
  '.': [[[0.25, 0], [0.35, 0], [0.35, 0.1], [0.25, 0.1], [0.25, 0]]],
  ',': [[[0.3, 0.1], [0.2, -0.15]]],
  ':': [[[0.25, 0.65], [0.35, 0.65], [0.35, 0.75], [0.25, 0.75], [0.25, 0.65]], [[0.25, 0.1], [0.35, 0.1], [0.35, 0.2], [0.25, 0.2], [0.25, 0.1]]],
  '/': [[[0.05, 0], [0.65, 1]]],
  '(': [[[0.5, 1], [0.25, 0.75], [0.25, 0.25], [0.5, 0]]],
  ')': [[[0.2, 1], [0.45, 0.75], [0.45, 0.25], [0.2, 0]]],
  '+': [[[0.1, 0.5], [0.65, 0.5]], [[0.375, 0.22], [0.375, 0.78]]],
  '=': [[[0.1, 0.65], [0.65, 0.65]], [[0.1, 0.35], [0.65, 0.35]]],
  '_': [[[0, -0.08], [0.75, -0.08]]],
};

function toArrayBuffer(data: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (data instanceof ArrayBuffer) return data;
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  return copy.buffer;
}

function buildRotationMatrix(
  rotation: 0 | 90 | 180 | 270,
  widthMm: number,
  heightMm: number,
): Mat6 {
  switch (rotation) {
    case 90:
      // 90° CW in Y-up space, shifted into positive quadrant
      return [0, -1, 1, 0, 0, widthMm];
    case 180:
      return [-1, 0, 0, -1, widthMm, heightMm];
    case 270:
      return [0, 1, -1, 0, heightMm, 0];
    default:
      return [1, 0, 0, 1, 0, 0];
  }
}

export interface OperatorListToIgmInput {
  operatorList: PdfOperatorListLike;
  ops?: PdfOpsMap;
  /** Page viewBox `[xMin, yMin, xMax, yMax]` in PDF points (default `[0, 0, 595, 842]`). */
  viewBox?: [number, number, number, number];
  /** Pre-parsed opentype.js fonts keyed by PDF `fontLoadedName`. */
  parsedFonts?: Map<string, OpenType.Font>;
  /** Fallback opentype.js font when a PDF font is not embedded. */
  fallbackFont?: OpenType.Font | null;
  options?: Pick<
    PdfParseOptions,
    'rotation' | 'scale' | 'curveToleranceMm' | 'includeText' | 'textLayerVisible'
  >;
}

export interface OperatorListToIgmOutput {
  doc: IgmDocument;
  textGlyphCount: number;
  fontsUsed: string[];
  warnings: string[];
}

/**
 * Pure, DOM-free converter from a PDF.js `getOperatorList()` stream directly into an `IgmDocument`.
 * Runs in Web Workers, Node.js, and browsers without `SVGGraphics`.
 */
export function operatorListToIgm(input: OperatorListToIgmInput): OperatorListToIgmOutput {
  const {
    operatorList,
    ops = DEFAULT_PDF_OPS,
    viewBox = [0, 0, 595, 842],
    parsedFonts = new Map<string, OpenType.Font>(),
    fallbackFont = null,
    options = {},
  } = input;

  const scale = options.scale ?? 1;
  const rotation = options.rotation ?? 0;
  const tol = Math.max(0.01, options.curveToleranceMm ?? 0.1);
  const includeText = options.includeText ?? true;
  const textLayerVisible = options.textLayerVisible ?? true;

  const ptScale = PT_TO_MM * scale;
  const pageWidthMm = (viewBox[2] - viewBox[0]) * ptScale;
  const pageHeightMm = (viewBox[3] - viewBox[1]) * ptScale;

  // Base CTM maps PDF user space (points, Y-up) -> CNC mm with page bottom-left at (0, 0) + optional rotation
  const baseScaleTranslate: Mat6 = [
    ptScale,
    0,
    0,
    ptScale,
    -viewBox[0] * ptScale,
    -viewBox[1] * ptScale,
  ];
  const rotMat = buildRotationMatrix(rotation, pageWidthMm, pageHeightMm);
  const initialCtm = multiplyMat6(rotMat, baseScaleTranslate);

  let state: GraphicsState = {
    ctm: [...initialCtm] as Mat6,
    strokeColor: '#000000',
    fillColor: '#000000',
    charSpacing: 0,
    wordSpacing: 0,
    hScale: 1,
    leading: 0,
    textRise: 0,
    fontName: '',
    fontSize: 12,
  };
  const stateStack: GraphicsState[] = [];

  let textMatrix: Mat6 = [1, 0, 0, 1, 0, 0];
  let textLineMatrix: Mat6 = [1, 0, 0, 1, 0, 0];

  const layerMap = new Map<string, IgmLayer>();
  const fontsUsedSet = new Set<string>();
  const warnings: string[] = [];
  let textGlyphCount = 0;
  let pathCounter = 0;
  let textCounter = 0;
  let usedStrokeFallback = false;

  const getOrCreateLayer = (
    id: string,
    name: string,
    color?: string,
    visible = true,
  ): IgmLayer => {
    let layer = layerMap.get(id);
    if (!layer) {
      layer = { id, name, visible, color, segments: [] };
      layerMap.set(id, layer);
    }
    return layer;
  };

  const pushPolyline = (layer: IgmLayer, pts: Pt2[], sourceId: string): void => {
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]!;
      const b = pts[i]!;
      if (Math.hypot(b.x - a.x, b.y - a.y) < 1e-6) continue;
      const seg: LineSegment = {
        type: 'line',
        kind: 'geometry',
        start: { x: a.x, y: a.y, z: 0 },
        end: { x: b.x, y: b.y, z: 0 },
        layer: layer.id,
        sourceRef: { kind: 'svg', elementId: sourceId },
      };
      layer.segments.push(seg);
    }
  };

  // Current pending path subpaths (already transformed into mm via current CTM at construction time)
  let currentSubpaths: Pt2[][] = [];
  let activeSubpath: Pt2[] | null = null;
  let curX = 0;
  let curY = 0;

  const resetPath = () => {
    currentSubpaths = [];
    activeSubpath = null;
  };

  const pathMoveTo = (x: number, y: number) => {
    curX = x;
    curY = y;
    const p = applyMat6(state.ctm, x, y);
    activeSubpath = [p];
    currentSubpaths.push(activeSubpath);
  };

  const pathLineTo = (x: number, y: number) => {
    curX = x;
    curY = y;
    const p = applyMat6(state.ctm, x, y);
    if (!activeSubpath) {
      activeSubpath = [p];
      currentSubpaths.push(activeSubpath);
    } else {
      activeSubpath.push(p);
    }
  };

  const pathCurveTo = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x3: number,
    y3: number,
  ) => {
    const p0 = activeSubpath?.[activeSubpath.length - 1] ?? applyMat6(state.ctm, curX, curY);
    const p1 = applyMat6(state.ctm, x1, y1);
    const p2 = applyMat6(state.ctm, x2, y2);
    const p3 = applyMat6(state.ctm, x3, y3);
    curX = x3;
    curY = y3;
    if (!activeSubpath) {
      activeSubpath = [p0];
      currentSubpaths.push(activeSubpath);
    }
    flattenCubic(p0, p1, p2, p3, tol, activeSubpath);
  };

  const pathClose = () => {
    if (activeSubpath && activeSubpath.length > 1) {
      const first = activeSubpath[0]!;
      const last = activeSubpath[activeSubpath.length - 1]!;
      if (Math.hypot(last.x - first.x, last.y - first.y) > 1e-6) {
        activeSubpath.push({ x: first.x, y: first.y });
      }
    }
  };

  const pathRectangle = (x: number, y: number, w: number, h: number) => {
    pathMoveTo(x, y);
    pathLineTo(x + w, y);
    pathLineTo(x + w, y + h);
    pathLineTo(x, y + h);
    pathClose();
  };

  const flushPath = (mode: 'stroke' | 'fill' | 'fillStroke', closeFirst: boolean) => {
    if (closeFirst) pathClose();
    if (currentSubpaths.length === 0) return;

    const color = mode === 'fill' ? state.fillColor : state.strokeColor;
    const prefix = mode === 'fill' ? 'pdf-fill' : 'pdf-stroke';
    const layerId = `${prefix}-${color}`;
    const layerName = `${mode === 'fill' ? 'PDF Fill' : 'PDF Stroke'} (${color})`;
    const layer = getOrCreateLayer(layerId, layerName, color, true);

    pathCounter += 1;
    const sourceId = `pdf-path-${pathCounter}`;
    for (const sub of currentSubpaths) {
      pushPolyline(layer, sub, sourceId);
    }
    resetPath();
  };

  const applyConstructPath = (args: unknown[]) => {
    // Format A (pdfjs-dist v3/v4): [opsArray: number[], coordsArray: number[], minMax?]
    const first = args[0];
    const second = args[1];
    if (Array.isArray(first) && (Array.isArray(second) || ArrayBuffer.isView(second))) {
      const subOps = first as number[];
      const coords = Array.from(second as ArrayLike<number>);
      let c = 0;
      for (const subOp of subOps) {
        if (subOp === ops.moveTo) {
          pathMoveTo(coords[c++] ?? 0, coords[c++] ?? 0);
        } else if (subOp === ops.lineTo) {
          pathLineTo(coords[c++] ?? 0, coords[c++] ?? 0);
        } else if (subOp === ops.curveTo) {
          const x1 = coords[c++] ?? 0;
          const y1 = coords[c++] ?? 0;
          const x2 = coords[c++] ?? 0;
          const y2 = coords[c++] ?? 0;
          const x3 = coords[c++] ?? 0;
          const y3 = coords[c++] ?? 0;
          pathCurveTo(x1, y1, x2, y2, x3, y3);
        } else if (subOp === ops.curveTo2) {
          const x2 = coords[c++] ?? 0;
          const y2 = coords[c++] ?? 0;
          const x3 = coords[c++] ?? 0;
          const y3 = coords[c++] ?? 0;
          pathCurveTo(curX, curY, x2, y2, x3, y3);
        } else if (subOp === ops.curveTo3) {
          const x1 = coords[c++] ?? 0;
          const y1 = coords[c++] ?? 0;
          const x3 = coords[c++] ?? 0;
          const y3 = coords[c++] ?? 0;
          pathCurveTo(x1, y1, x3, y3, x3, y3);
        } else if (subOp === ops.closePath) {
          pathClose();
        } else if (subOp === ops.rectangle) {
          const x = coords[c++] ?? 0;
          const y = coords[c++] ?? 0;
          const w = coords[c++] ?? 0;
          const h = coords[c++] ?? 0;
          pathRectangle(x, y, w, h);
        }
      }
      return;
    }

    // Format B (pdfjs-dist v5+ DrawOPS): [paintOp: number, [Float32Array], minMax]
    if (typeof first === 'number' && Array.isArray(second) && second[0]) {
      const buf = Array.from(second[0] as ArrayLike<number>);
      let i = 0;
      while (i < buf.length) {
        const code = buf[i++];
        if (code === 0) {
          pathMoveTo(buf[i++] ?? 0, buf[i++] ?? 0);
        } else if (code === 1) {
          pathLineTo(buf[i++] ?? 0, buf[i++] ?? 0);
        } else if (code === 2) {
          pathCurveTo(
            buf[i++] ?? 0,
            buf[i++] ?? 0,
            buf[i++] ?? 0,
            buf[i++] ?? 0,
            buf[i++] ?? 0,
            buf[i++] ?? 0,
          );
        } else if (code === 3) {
          const qx = buf[i++] ?? 0;
          const qy = buf[i++] ?? 0;
          const ex = buf[i++] ?? 0;
          const ey = buf[i++] ?? 0;
          const p0 = activeSubpath?.[activeSubpath.length - 1] ?? applyMat6(state.ctm, curX, curY);
          if (!activeSubpath) {
            activeSubpath = [p0];
            currentSubpaths.push(activeSubpath);
          }
          flattenQuad(p0, applyMat6(state.ctm, qx, qy), applyMat6(state.ctm, ex, ey), tol, activeSubpath);
          curX = ex;
          curY = ey;
        } else if (code === 4) {
          pathClose();
        }
      }
      if (first === ops.stroke) flushPath('stroke', false);
      else if (first === ops.closeStroke) flushPath('stroke', true);
      else if (first === ops.fill || first === ops.eoFill) flushPath('fill', false);
      else if (first === ops.fillStroke || first === ops.eoFillStroke) flushPath('fillStroke', false);
      else if (first === ops.closeFillStroke || first === ops.closeEOFillStroke)
        flushPath('fillStroke', true);
      else if (first === ops.endPath) resetPath();
    }
  };

  const renderGlyphs = (glyphs: unknown[]) => {
    if (!Array.isArray(glyphs) || glyphs.length === 0) return;

    const font = parsedFonts.get(state.fontName) ?? fallbackFont ?? null;
    const textLayer = includeText
      ? getOrCreateLayer('pdf-text', 'PDF Text', '#60a5fa', textLayerVisible)
      : null;

    // Text rendering matrix: CTM * TextMatrix * [fontSize * hScale, 0, 0, fontSize, 0, textRise]
    const fontSize = state.fontSize || 12;
    const hScale = state.hScale || 1;

    for (const item of glyphs) {
      if (typeof item === 'number') {
        // Kerning adjustment in thousandths of a unit of text space (negative moves right)
        const tx = (-item / 1000) * fontSize * hScale;
        textMatrix = multiplyMat6(textMatrix, [1, 0, 0, 1, tx, 0]);
        continue;
      }

      if (!item || typeof item !== 'object') continue;
      const g = item as {
        unicode?: string;
        width?: number;
        isSpace?: boolean;
      };
      const ch = g.unicode ?? '';
      const widthUnits = typeof g.width === 'number' ? g.width : 500;
      const advance =
        (widthUnits / 1000) * fontSize * hScale +
        state.charSpacing * hScale +
        (ch === ' ' || g.isSpace ? state.wordSpacing * hScale : 0);

      if (ch && ch.trim().length > 0) {
        textGlyphCount += 1;

        if (includeText && textLayer) {
          textCounter += 1;
          const sourceId = `pdf-text-${textCounter}`;
          const trm = multiplyMat6(state.ctm, textMatrix);
          const glyphMatrix = multiplyMat6(trm, [hScale, 0, 0, 1, 0, state.textRise]);

          if (font) {
            const path = font.getPath(ch, 0, 0, fontSize);
            let sub: Pt2[] = [];
            let gx = 0;
            let gy = 0;
            const flushSub = () => {
              if (sub.length > 1) pushPolyline(textLayer, sub, sourceId);
              sub = [];
            };
            for (const cmd of path.commands) {
              if (cmd.type === 'M') {
                flushSub();
                gx = cmd.x;
                gy = -cmd.y;
                sub.push(applyMat6(glyphMatrix, gx, gy));
              } else if (cmd.type === 'L') {
                gx = cmd.x;
                gy = -cmd.y;
                sub.push(applyMat6(glyphMatrix, gx, gy));
              } else if (cmd.type === 'Q') {
                const p0 = sub[sub.length - 1] ?? applyMat6(glyphMatrix, gx, gy);
                const p1 = applyMat6(glyphMatrix, cmd.x1, -cmd.y1);
                const p2 = applyMat6(glyphMatrix, cmd.x, -cmd.y);
                flattenQuad(p0, p1, p2, tol, sub);
                gx = cmd.x;
                gy = -cmd.y;
              } else if (cmd.type === 'C') {
                const p0 = sub[sub.length - 1] ?? applyMat6(glyphMatrix, gx, gy);
                const p1 = applyMat6(glyphMatrix, cmd.x1, -cmd.y1);
                const p2 = applyMat6(glyphMatrix, cmd.x2, -cmd.y2);
                const p3 = applyMat6(glyphMatrix, cmd.x, -cmd.y);
                flattenCubic(p0, p1, p2, p3, tol, sub);
                gx = cmd.x;
                gy = -cmd.y;
              } else if (cmd.type === 'Z') {
                if (sub.length > 1) {
                  sub.push({ ...sub[0]! });
                }
                flushSub();
              }
            }
            flushSub();
          } else {
            usedStrokeFallback = true;
            const strokes = STROKE_FONT[ch.toUpperCase()];
            if (strokes) {
              const capHeight = fontSize * 0.72;
              const charWidth = (widthUnits / 1000) * fontSize;
              for (const stroke of strokes) {
                const pts = stroke.map(([sx, sy]) =>
                  applyMat6(glyphMatrix, sx * charWidth, sy * capHeight),
                );
                pushPolyline(textLayer, pts, sourceId);
              }
            }
          }
        }
      }

      textMatrix = multiplyMat6(textMatrix, [1, 0, 0, 1, advance, 0]);
    }
  };

  const { fnArray, argsArray } = operatorList;
  for (let i = 0; i < fnArray.length; i++) {
    const fn = fnArray[i]!;
    const rawArgs = argsArray[i];
    const args: unknown[] = Array.isArray(rawArgs)
      ? rawArgs
      : ArrayBuffer.isView(rawArgs)
        ? Array.from(rawArgs as unknown as ArrayLike<number>)
        : [];

    if (fn === ops.save) {
      stateStack.push({ ...state, ctm: [...state.ctm] as Mat6 });
    } else if (fn === ops.restore) {
      const prev = stateStack.pop();
      if (prev) state = prev;
    } else if (fn === ops.transform) {
      const m: Mat6 = [
        Number(args[0] ?? 1),
        Number(args[1] ?? 0),
        Number(args[2] ?? 0),
        Number(args[3] ?? 1),
        Number(args[4] ?? 0),
        Number(args[5] ?? 0),
      ];
      state.ctm = multiplyMat6(state.ctm, m);
    } else if (fn === ops.constructPath) {
      applyConstructPath(args);
    } else if (fn === ops.moveTo) {
      pathMoveTo(Number(args[0] ?? 0), Number(args[1] ?? 0));
    } else if (fn === ops.lineTo) {
      pathLineTo(Number(args[0] ?? 0), Number(args[1] ?? 0));
    } else if (fn === ops.curveTo) {
      pathCurveTo(
        Number(args[0] ?? 0),
        Number(args[1] ?? 0),
        Number(args[2] ?? 0),
        Number(args[3] ?? 0),
        Number(args[4] ?? 0),
        Number(args[5] ?? 0),
      );
    } else if (fn === ops.curveTo2) {
      pathCurveTo(
        curX,
        curY,
        Number(args[0] ?? 0),
        Number(args[1] ?? 0),
        Number(args[2] ?? 0),
        Number(args[3] ?? 0),
      );
    } else if (fn === ops.curveTo3) {
      pathCurveTo(
        Number(args[0] ?? 0),
        Number(args[1] ?? 0),
        Number(args[2] ?? 0),
        Number(args[3] ?? 0),
        Number(args[2] ?? 0),
        Number(args[3] ?? 0),
      );
    } else if (fn === ops.closePath) {
      pathClose();
    } else if (fn === ops.rectangle) {
      pathRectangle(
        Number(args[0] ?? 0),
        Number(args[1] ?? 0),
        Number(args[2] ?? 0),
        Number(args[3] ?? 0),
      );
    } else if (fn === ops.stroke) {
      flushPath('stroke', false);
    } else if (fn === ops.closeStroke) {
      flushPath('stroke', true);
    } else if (fn === ops.fill || fn === ops.eoFill) {
      flushPath('fill', false);
    } else if (fn === ops.fillStroke || fn === ops.eoFillStroke) {
      flushPath('fillStroke', false);
    } else if (fn === ops.closeFillStroke || fn === ops.closeEOFillStroke) {
      flushPath('fillStroke', true);
    } else if (fn === ops.endPath) {
      resetPath();
    } else if (fn === ops.setStrokeRGBColor) {
      state.strokeColor = parseColorArg(args, 'rgb');
    } else if (fn === ops.setStrokeGray) {
      state.strokeColor = parseColorArg(args, 'gray');
    } else if (fn === ops.setStrokeCMYKColor) {
      state.strokeColor = parseColorArg(args, 'cmyk');
    } else if (fn === ops.setFillRGBColor) {
      state.fillColor = parseColorArg(args, 'rgb');
    } else if (fn === ops.setFillGray) {
      state.fillColor = parseColorArg(args, 'gray');
    } else if (fn === ops.setFillCMYKColor) {
      state.fillColor = parseColorArg(args, 'cmyk');
    } else if (fn === ops.beginText) {
      textMatrix = [1, 0, 0, 1, 0, 0];
      textLineMatrix = [1, 0, 0, 1, 0, 0];
    } else if (fn === ops.endText) {
      // no-op
    } else if (fn === ops.setCharSpacing) {
      state.charSpacing = Number(args[0] ?? 0);
    } else if (fn === ops.setWordSpacing) {
      state.wordSpacing = Number(args[0] ?? 0);
    } else if (fn === ops.setHScale) {
      state.hScale = Number(args[0] ?? 100) / 100;
    } else if (fn === ops.setLeading) {
      state.leading = Number(args[0] ?? 0);
    } else if (fn === ops.setFont) {
      state.fontName = String(args[0] ?? '');
      state.fontSize = Number(args[1] ?? 12);
      if (state.fontName) fontsUsedSet.add(state.fontName);
    } else if (fn === ops.setTextRise) {
      state.textRise = Number(args[0] ?? 0);
    } else if (fn === ops.moveText) {
      const m: Mat6 = [1, 0, 0, 1, Number(args[0] ?? 0), Number(args[1] ?? 0)];
      textLineMatrix = multiplyMat6(textLineMatrix, m);
      textMatrix = [...textLineMatrix] as Mat6;
    } else if (fn === ops.setLeadingMoveText) {
      const tx = Number(args[0] ?? 0);
      const ty = Number(args[1] ?? 0);
      state.leading = -ty;
      const m: Mat6 = [1, 0, 0, 1, tx, ty];
      textLineMatrix = multiplyMat6(textLineMatrix, m);
      textMatrix = [...textLineMatrix] as Mat6;
    } else if (fn === ops.setTextMatrix) {
      const m: Mat6 = [
        Number(args[0] ?? 1),
        Number(args[1] ?? 0),
        Number(args[2] ?? 0),
        Number(args[3] ?? 1),
        Number(args[4] ?? 0),
        Number(args[5] ?? 0),
      ];
      textLineMatrix = [...m] as Mat6;
      textMatrix = [...m] as Mat6;
    } else if (fn === ops.nextLine) {
      const m: Mat6 = [1, 0, 0, 1, 0, -state.leading];
      textLineMatrix = multiplyMat6(textLineMatrix, m);
      textMatrix = [...textLineMatrix] as Mat6;
    } else if (fn === ops.showText || fn === ops.showSpacedText) {
      renderGlyphs(args[0] as unknown[]);
    }
  }

  if (usedStrokeFallback) {
    warnings.push(
      'Some PDF fonts were not embedded; rendered with built-in vector stroke font (load a .ttf/.otf fallback font for exact outlines).',
    );
  }
  if (!includeText && textGlyphCount > 0) {
    warnings.push(
      `Skipped ${textGlyphCount} text glyph(s). Enable "Include Text Layer" to vectorize PDF text.`,
    );
  }

  const layers = Array.from(layerMap.values()).filter((l) => l.segments.length > 0);
  const bounds = computeBounds(layers);

  const doc: IgmDocument = {
    version: 1,
    units: 'mm',
    executable: false,
    layers,
    bounds,
    metadata: {
      sourceFormat: 'pdf',
      textGlyphCount,
      fontsUsed: Array.from(fontsUsedSet),
    },
  };

  return {
    doc,
    pageCount: 1,
    textGlyphCount,
    fontsUsed: Array.from(fontsUsedSet),
    warnings,
  } as OperatorListToIgmOutput;
}

let pdfWorkerPort: Worker | null = null;

/**
 * Lazy-loads `pdfjs-dist` and parses a PDF binary (`ArrayBuffer` or `Uint8Array`) directly
 * from PDF graphics opcodes (`page.getOperatorList()`) into an `IgmDocument` without DOM/SVG.
 *
 * Text (`OPS.showText`) is optionally vectorized into a separate `pdf-text` layer using
 * embedded PDF fonts (via `opentype.js`), an optional fallback/loaded `.ttf`/`.otf` font,
 * or a built-in single-line stroke font.
 */
export async function parsePdfToIgm(
  pdfData: ArrayBuffer | Uint8Array,
  options: PdfParseOptions = {},
): Promise<PdfImportResult> {
  const pdfjs = await import('pdfjs-dist');

  if (!pdfWorkerPort && typeof window !== 'undefined' && typeof Worker !== 'undefined') {
    try {
      pdfWorkerPort = new Worker(new URL('./pdf.worker.ts', import.meta.url), {
        type: 'module',
      });
      pdfjs.GlobalWorkerOptions.workerPort = pdfWorkerPort;
    } catch {
      pdfWorkerPort = null;
    }
  }

  const bytes = pdfData instanceof Uint8Array ? new Uint8Array(pdfData) : new Uint8Array(pdfData);
  const loadingTask = pdfjs.getDocument({
    data: bytes,
    useSystemFonts: false,
    disableFontFace: true,
    isEvalSupported: false,
  });

  const pdfDoc = await loadingTask.promise;
  try {
    const pageCount = pdfDoc.numPages;
    const pageNumber = Math.max(1, Math.min(pageCount, Math.trunc(options.pageNumber ?? 1)));
    const page = await pdfDoc.getPage(pageNumber);

    const operatorList = await page.getOperatorList();
    const viewBox = (page.view as [number, number, number, number]) ?? [0, 0, 595, 842];
    const includeText = options.includeText ?? true;

    const parsedFonts = new Map<string, OpenType.Font>();
    let fallbackFont: OpenType.Font | null = null;
    const warnings: string[] = [];

    if (includeText) {
      // Collect font names referenced in the operator list
      const ops = pdfjs.OPS as unknown as PdfOpsMap;
      const neededFonts = new Set<string>();
      for (let i = 0; i < operatorList.fnArray.length; i++) {
        if (operatorList.fnArray[i] === ops.setFont) {
          const arg = operatorList.argsArray[i];
          const fontName = Array.isArray(arg) ? String(arg[0] ?? '') : '';
          if (fontName) neededFonts.add(fontName);
        }
      }

      if (neededFonts.size > 0) {
        const opentype = await import('opentype.js');

        if (options.fallbackFontBuffer) {
          try {
            fallbackFont = opentype.parse(toArrayBuffer(options.fallbackFontBuffer));
          } catch {
            warnings.push('Failed to parse supplied fallback font file.');
          }
        }

        for (const fontName of neededFonts) {
          // 1. Try embedded font bytes from PDF.js commonObjs
          try {
            if (page.commonObjs.has(fontName)) {
              const fontObj = page.commonObjs.get(fontName) as
                | { data?: Uint8Array | ArrayBuffer; name?: string }
                | undefined;
              if (fontObj?.data && fontObj.data.byteLength > 0) {
                const parsed = opentype.parse(toArrayBuffer(fontObj.data));
                parsedFonts.set(fontName, parsed);
                continue;
              }
            }
          } catch {
            // Embedded font may be CFF/Type1/Type3 unsupported by opentype.js — try loader/fallback
          }

          // 2. Try caller-supplied async font loader (e.g. machine root settings/fonts/)
          if (options.loadFont) {
            try {
              const loaded = await options.loadFont(fontName);
              if (loaded && loaded.byteLength > 0) {
                parsedFonts.set(fontName, opentype.parse(toArrayBuffer(loaded)));
              }
            } catch {
              // Fall back to fallbackFont or stroke font
            }
          }
        }
      }
    }

    const result = operatorListToIgm({
      operatorList,
      ops: pdfjs.OPS as unknown as PdfOpsMap,
      viewBox,
      parsedFonts,
      fallbackFont,
      options,
    });

    return {
      doc: result.doc,
      pageCount,
      pageNumber,
      textGlyphCount: result.textGlyphCount,
      fontsUsed: result.fontsUsed,
      warnings: [...warnings, ...result.warnings],
    };
  } finally {
    await pdfDoc.destroy();
  }
}
