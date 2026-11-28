/// <reference path="./types-svg-path-parser.d.ts" />
import parseSVG from 'svg-path-parser';
import {
  type IgmDocument,
  type IgmLayer,
  type IgmSegment,
  type LineSegment,
  computeBounds,
} from '@kmxcnc/igm';

export interface SvgParseOptions {
  /** DPI used to convert px to mm (default: 96, standard CSS/Inkscape 0.92+). */
  dpi?: number;
  /** Flip Y coordinate so SVG top-down maps to CNC bottom-up (+Y up). Default: true. */
  flipY?: boolean;
  /** Number of line subdivisions per cubic/quadratic Bezier or elliptical arc segment (default: 16). */
  curveSubdivisions?: number;
  /** Extra uniform scale multiplier applied after unit conversion (default: 1). */
  scale?: number;
}

/** 2D affine matrix [a, b, c, d, e, f]: x' = a*x + c*y + e, y' = b*x + d*y + f */
type Matrix2D = [number, number, number, number, number, number];

const IDENTITY: Matrix2D = [1, 0, 0, 1, 0, 0];

function mulMatrix(m1: Matrix2D, m2: Matrix2D): Matrix2D {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

function applyMatrix(m: Matrix2D, x: number, y: number): { x: number; y: number } {
  return {
    x: m[0] * x + m[2] * y + m[4],
    y: m[1] * x + m[3] * y + m[5],
  };
}

function parseTransformAttr(attr: string | undefined): Matrix2D {
  if (!attr) return IDENTITY;
  let mat: Matrix2D = IDENTITY;
  const regex = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(attr)) !== null) {
    const fn = (match[1] ?? '').toLowerCase();
    const args = (match[2] ?? '')
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);

    let next: Matrix2D = IDENTITY;
    if (fn === 'translate') {
      const tx = args[0] ?? 0;
      const ty = args[1] ?? 0;
      next = [1, 0, 0, 1, tx, ty];
    } else if (fn === 'scale') {
      const sx = args[0] ?? 1;
      const sy = args[1] ?? sx;
      next = [sx, 0, 0, sy, 0, 0];
    } else if (fn === 'rotate') {
      const deg = args[0] ?? 0;
      const rad = (deg * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const cx = args[1] ?? 0;
      const cy = args[2] ?? 0;
      if (cx !== 0 || cy !== 0) {
        next = mulMatrix(
          mulMatrix([1, 0, 0, 1, cx, cy], [cos, sin, -sin, cos, 0, 0]),
          [1, 0, 0, 1, -cx, -cy],
        );
      } else {
        next = [cos, sin, -sin, cos, 0, 0];
      }
    } else if (fn === 'matrix' && args.length >= 6) {
      next = [
        args[0] ?? 1,
        args[1] ?? 0,
        args[2] ?? 0,
        args[3] ?? 1,
        args[4] ?? 0,
        args[5] ?? 0,
      ];
    } else if (fn === 'skewx') {
      const rad = ((args[0] ?? 0) * Math.PI) / 180;
      next = [1, 0, Math.tan(rad), 1, 0, 0];
    } else if (fn === 'skewy') {
      const rad = ((args[0] ?? 0) * Math.PI) / 180;
      next = [1, Math.tan(rad), 0, 1, 0, 0];
    }
    mat = mulMatrix(mat, next);
  }
  return mat;
}

function parseLengthToMm(value: string | undefined, dpi: number): number | null {
  if (!value) return null;
  const match = value.trim().match(/^([+-]?(?:\d+\.?\d*|\.\d+))\s*([a-z%]*)$/i);
  if (!match || !match[1]) return null;
  const num = Number.parseFloat(match[1]);
  if (!Number.isFinite(num)) return null;
  const unit = (match[2] ?? '').toLowerCase();
  switch (unit) {
    case 'mm':
      return num;
    case 'cm':
      return num * 10;
    case 'in':
      return num * 25.4;
    case 'pt':
      return (num * 25.4) / 72;
    case 'pc':
      return (num * 25.4) / 6;
    case 'px':
    case '':
      return (num * 25.4) / dpi;
    default:
      return null;
  }
}

interface XmlNode {
  tag: string;
  attrs: Record<string, string>;
  children: XmlNode[];
}

function parseAttributes(attrStr: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const regex = /([a-zA-Z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(attrStr)) !== null) {
    const key = match[1];
    if (!key) continue;
    attrs[key] = match[2] ?? match[3] ?? '';
  }
  return attrs;
}

/**
 * Minimal DOM-free XML parser tailored for SVG documents.
 */
function parseXml(xml: string): XmlNode | null {
  // Strip XML comments, processing instructions, DOCTYPE
  const cleaned = xml
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\?[\s\S]*?\?>/g, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '');

  const stack: XmlNode[] = [];
  let root: XmlNode | null = null;

  const tagRegex = /<(\/?)([a-zA-Z_:][\w:.-]*)([^>]*?)(\/?)>/g;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(cleaned)) !== null) {
    const isClosing = match[1] === '/';
    const tag = (match[2] ?? '').toLowerCase();
    const attrStr = match[3] ?? '';
    const isSelfClosing = match[4] === '/';

    if (isClosing) {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i]?.tag === tag) {
          stack.length = i;
          break;
        }
      }
      continue;
    }

    const node: XmlNode = {
      tag,
      attrs: parseAttributes(attrStr),
      children: [],
    };

    const parent = stack[stack.length - 1];
    if (parent) {
      parent.children.push(node);
    } else if (!root) {
      root = node;
    }

    if (!isSelfClosing) {
      stack.push(node);
    }
  }

  return root;
}

function sampleCubicBezier(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  steps: number,
): Array<{ x: number; y: number }> {
  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    const x =
      mt * mt * mt * x0 +
      3 * mt * mt * t * x1 +
      3 * mt * t * t * x2 +
      t * t * t * x3;
    const y =
      mt * mt * mt * y0 +
      3 * mt * mt * t * y1 +
      3 * mt * t * t * y2 +
      t * t * t * y3;
    pts.push({ x, y });
  }
  return pts;
}

function sampleQuadraticBezier(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  steps: number,
): Array<{ x: number; y: number }> {
  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    const x = mt * mt * x0 + 2 * mt * t * x1 + t * t * x2;
    const y = mt * mt * y0 + 2 * mt * t * y1 + t * t * y2;
    pts.push({ x, y });
  }
  return pts;
}

/**
 * Samples an SVG elliptical arc (endpoint parameterization) into polyline points.
 * Implements the W3C SVG 1.1 F.6.5 conversion from endpoint to center parameterization.
 */
function sampleSvgArc(
  x1: number,
  y1: number,
  rxIn: number,
  ryIn: number,
  phiDeg: number,
  largeArc: boolean,
  sweep: boolean,
  x2: number,
  y2: number,
  steps: number,
): Array<{ x: number; y: number }> {
  if (Math.hypot(x2 - x1, y2 - y1) < 1e-9) return [];
  let rx = Math.abs(rxIn);
  let ry = Math.abs(ryIn);
  if (rx < 1e-9 || ry < 1e-9) return [{ x: x2, y: y2 }];

  const phi = (phiDeg * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);

  const dx2 = (x1 - x2) / 2;
  const dy2 = (y1 - y2) / 2;
  const x1p = cosPhi * dx2 + sinPhi * dy2;
  const y1p = -sinPhi * dx2 + cosPhi * dy2;

  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    const sqrtLambda = Math.sqrt(lambda);
    rx *= sqrtLambda;
    ry *= sqrtLambda;
  }

  const rx2 = rx * rx;
  const ry2 = ry * ry;
  const x1p2 = x1p * x1p;
  const y1p2 = y1p * y1p;

  const num = Math.max(0, rx2 * ry2 - rx2 * y1p2 - ry2 * x1p2);
  const den = rx2 * y1p2 + ry2 * x1p2;
  const factor = (largeArc === sweep ? -1 : 1) * (den > 1e-12 ? Math.sqrt(num / den) : 0);

  const cxp = factor * ((rx * y1p) / ry);
  const cyp = factor * (-(ry * x1p) / rx);

  const cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;

  const angleBetween = (ux: number, uy: number, vx: number, vy: number): number => {
    const dot = ux * vx + uy * vy;
    const len = Math.hypot(ux, uy) * Math.hypot(vx, vy);
    const ratio = len > 1e-12 ? Math.max(-1, Math.min(1, dot / len)) : 1;
    const sign = ux * vy - uy * vx < 0 ? -1 : 1;
    return sign * Math.acos(ratio);
  };

  const vx1 = (x1p - cxp) / rx;
  const vy1 = (y1p - cyp) / ry;
  const vx2 = (-x1p - cxp) / rx;
  const vy2 = (-y1p - cyp) / ry;

  const theta1 = angleBetween(1, 0, vx1, vy1);
  let dTheta = angleBetween(vx1, vy1, vx2, vy2);

  if (!sweep && dTheta > 0) dTheta -= 2 * Math.PI;
  if (sweep && dTheta < 0) dTheta += 2 * Math.PI;

  const pts: Array<{ x: number; y: number }> = [];
  const segCount = Math.max(4, Math.ceil((Math.abs(dTheta) / (Math.PI / 2)) * (steps / 2)));
  for (let i = 1; i <= segCount; i++) {
    const theta = theta1 + (dTheta * i) / segCount;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    const x = cosPhi * rx * cosT - sinPhi * ry * sinT + cx;
    const y = sinPhi * rx * cosT + cosPhi * ry * sinT + cy;
    pts.push({ x, y });
  }
  return pts;
}

function parseStyleProp(style: string | undefined, prop: string): string | undefined {
  if (!style) return undefined;
  const regex = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'i');
  const match = style.match(regex);
  return match?.[1]?.trim();
}

function isNodeVisible(attrs: Record<string, string>, inheritedVisible: boolean): boolean {
  if (!inheritedVisible) return false;
  const display = attrs.display ?? parseStyleProp(attrs.style, 'display');
  const visibility = attrs.visibility ?? parseStyleProp(attrs.style, 'visibility');
  if (display === 'none' || visibility === 'hidden') return false;
  return true;
}

function getStrokeColor(attrs: Record<string, string>, inherited?: string): string | undefined {
  const stroke = attrs.stroke ?? parseStyleProp(attrs.style, 'stroke');
  if (stroke && stroke !== 'none') return stroke;
  return inherited;
}

/**
 * Parses an SVG string into an IGM document (canonical mm) without requiring DOM APIs.
 */
export function parseSvgToIgm(svgText: string, options: SvgParseOptions = {}): IgmDocument {
  const dpi = options.dpi ?? 96;
  const flipY = options.flipY ?? true;
  const curveSteps = Math.max(4, options.curveSubdivisions ?? 16);
  const extraScale = options.scale ?? 1;

  const root = parseXml(svgText);
  if (!root || root.tag !== 'svg') {
    return {
      version: 1,
      units: 'mm',
      executable: false,
      layers: [],
      bounds: computeBounds([]),
      metadata: { source: 'svg', error: 'No <svg> root element found' },
    };
  }

  // Determine mm per SVG user unit from width/height & viewBox
  const widthMm = parseLengthToMm(root.attrs.width, dpi);
  const heightMm = parseLengthToMm(root.attrs.height, dpi);
  let scaleX = (25.4 / dpi) * extraScale;
  let scaleY = (25.4 / dpi) * extraScale;
  let viewBoxHeightMm = heightMm ?? 0;
  let viewBoxMinX = 0;
  let viewBoxMinY = 0;

  if (root.attrs.viewBox) {
    const vb = root.attrs.viewBox
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (vb.length === 4 && vb.every((n) => Number.isFinite(n))) {
      const vbX = vb[0] ?? 0;
      const vbY = vb[1] ?? 0;
      const vbW = vb[2] ?? 0;
      const vbH = vb[3] ?? 0;
      viewBoxMinX = vbX;
      viewBoxMinY = vbY;
      if (widthMm !== null && vbW > 0) {
        scaleX = (widthMm / vbW) * extraScale;
      }
      if (heightMm !== null && vbH > 0) {
        scaleY = (heightMm / vbH) * extraScale;
      } else if (widthMm !== null && vbW > 0) {
        scaleY = scaleX;
      }
      viewBoxHeightMm = vbH * scaleY;
    }
  } else if (heightMm !== null) {
    viewBoxHeightMm = heightMm * extraScale;
  }

  // Map SVG user coordinates -> canonical mm
  const toMm = (pt: { x: number; y: number }): { x: number; y: number } => {
    const x = (pt.x - viewBoxMinX) * scaleX;
    const yRaw = (pt.y - viewBoxMinY) * scaleY;
    const y = flipY ? (viewBoxHeightMm > 0 ? viewBoxHeightMm - yRaw : -yRaw) : yRaw;
    return { x, y };
  };

  const layerMap = new Map<string, IgmLayer>();
  const ensureLayer = (id: string, name: string, visible: boolean, color?: string): IgmLayer => {
    let layer = layerMap.get(id);
    if (!layer) {
      layer = { id, name, visible, ...(color ? { color } : {}), segments: [] };
      layerMap.set(id, layer);
    }
    return layer;
  };

  let elementCounter = 0;

  const pushPolyline = (
    layer: IgmLayer,
    pts: Array<{ x: number; y: number }>,
    matrix: Matrix2D,
    elementId: string,
    closed = false,
  ) => {
    if (pts.length < 2) return;
    const transformed = pts.map((p) => toMm(applyMatrix(matrix, p.x, p.y)));
    const count = closed ? transformed.length : transformed.length - 1;
    for (let i = 0; i < count; i++) {
      const p0 = transformed[i];
      const p1 = transformed[(i + 1) % transformed.length];
      if (!p0 || !p1) continue;
      const seg: LineSegment = {
        type: 'line',
        kind: 'geometry',
        start: { x: p0.x, y: p0.y, z: 0 },
        end: { x: p1.x, y: p1.y, z: 0 },
        layer: layer.id,
        sourceRef: { kind: 'svg', elementId },
      };
      layer.segments.push(seg);
    }
  };

  const pushPathData = (
    layer: IgmLayer,
    d: string,
    matrix: Matrix2D,
    elementId: string,
  ) => {
    const commands = parseSVG.makeAbsolute(parseSVG(d));
    let curX = 0;
    let curY = 0;
    let prevControlX = 0;
    let prevControlY = 0;
    let prevCmdCode = '';

    const emitLine = (x1: number, y1: number, x2: number, y2: number) => {
      const p0 = toMm(applyMatrix(matrix, x1, y1));
      const p1 = toMm(applyMatrix(matrix, x2, y2));
      const seg: LineSegment = {
        type: 'line',
        kind: 'geometry',
        start: { x: p0.x, y: p0.y, z: 0 },
        end: { x: p1.x, y: p1.y, z: 0 },
        layer: layer.id,
        sourceRef: { kind: 'svg', elementId },
      };
      layer.segments.push(seg);
    };

    for (const cmd of commands) {
      const code = cmd.code;
      const x = cmd.x ?? curX;
      const y = cmd.y ?? curY;

      if (code === 'M') {
        curX = x;
        curY = y;
      } else if (code === 'L' || code === 'H' || code === 'V' || code === 'Z') {
        if (Math.hypot(x - curX, y - curY) > 1e-9) {
          emitLine(curX, curY, x, y);
        }
        curX = x;
        curY = y;
      } else if (code === 'C') {
        const x1 = cmd.x1 ?? curX;
        const y1 = cmd.y1 ?? curY;
        const x2 = cmd.x2 ?? x;
        const y2 = cmd.y2 ?? y;
        const pts = sampleCubicBezier(curX, curY, x1, y1, x2, y2, x, y, curveSteps);
        let px = curX;
        let py = curY;
        for (const pt of pts) {
          emitLine(px, py, pt.x, pt.y);
          px = pt.x;
          py = pt.y;
        }
        prevControlX = x2;
        prevControlY = y2;
        curX = x;
        curY = y;
      } else if (code === 'S') {
        const x1 = prevCmdCode === 'C' || prevCmdCode === 'S' ? 2 * curX - prevControlX : curX;
        const y1 = prevCmdCode === 'C' || prevCmdCode === 'S' ? 2 * curY - prevControlY : curY;
        const x2 = cmd.x2 ?? x;
        const y2 = cmd.y2 ?? y;
        const pts = sampleCubicBezier(curX, curY, x1, y1, x2, y2, x, y, curveSteps);
        let px = curX;
        let py = curY;
        for (const pt of pts) {
          emitLine(px, py, pt.x, pt.y);
          px = pt.x;
          py = pt.y;
        }
        prevControlX = x2;
        prevControlY = y2;
        curX = x;
        curY = y;
      } else if (code === 'Q') {
        const x1 = cmd.x1 ?? curX;
        const y1 = cmd.y1 ?? curY;
        const pts = sampleQuadraticBezier(curX, curY, x1, y1, x, y, curveSteps);
        let px = curX;
        let py = curY;
        for (const pt of pts) {
          emitLine(px, py, pt.x, pt.y);
          px = pt.x;
          py = pt.y;
        }
        prevControlX = x1;
        prevControlY = y1;
        curX = x;
        curY = y;
      } else if (code === 'T') {
        const x1 = prevCmdCode === 'Q' || prevCmdCode === 'T' ? 2 * curX - prevControlX : curX;
        const y1 = prevCmdCode === 'Q' || prevCmdCode === 'T' ? 2 * curY - prevControlY : curY;
        const pts = sampleQuadraticBezier(curX, curY, x1, y1, x, y, curveSteps);
        let px = curX;
        let py = curY;
        for (const pt of pts) {
          emitLine(px, py, pt.x, pt.y);
          px = pt.x;
          py = pt.y;
        }
        prevControlX = x1;
        prevControlY = y1;
        curX = x;
        curY = y;
      } else if (code === 'A') {
        const pts = sampleSvgArc(
          curX,
          curY,
          cmd.rx ?? 0,
          cmd.ry ?? 0,
          cmd.xAxisRotation ?? 0,
          Boolean(cmd.largeArc),
          Boolean(cmd.sweep),
          x,
          y,
          curveSteps,
        );
        let px = curX;
        let py = curY;
        for (const pt of pts) {
          emitLine(px, py, pt.x, pt.y);
          px = pt.x;
          py = pt.y;
        }
        curX = x;
        curY = y;
      }

      prevCmdCode = code;
    }
  };

  const walk = (
    node: XmlNode,
    parentMatrix: Matrix2D,
    currentLayerId: string,
    currentLayerName: string,
    inheritedVisible: boolean,
    inheritedStroke?: string,
  ) => {
    const localMatrix = parseTransformAttr(node.attrs.transform);
    const matrix = mulMatrix(parentMatrix, localMatrix);
    const visible = isNodeVisible(node.attrs, inheritedVisible);
    const stroke = getStrokeColor(node.attrs, inheritedStroke);

    if (node.tag === 'defs' || node.tag === 'clippath' || node.tag === 'mask' || node.tag === 'style') {
      return;
    }

    if (node.tag === 'g') {
      const gId = node.attrs.id ?? currentLayerId;
      const gName = node.attrs['inkscape:label'] ?? node.attrs.id ?? currentLayerName;
      ensureLayer(gId, gName, visible, stroke);
      for (const child of node.children) {
        walk(child, matrix, gId, gName, visible, stroke);
      }
      return;
    }

    if (node.tag === 'svg') {
      for (const child of node.children) {
        walk(child, matrix, currentLayerId, currentLayerName, visible, stroke);
      }
      return;
    }

    elementCounter += 1;
    const elementId = node.attrs.id ?? `${node.tag}-${elementCounter}`;
    const layer = ensureLayer(currentLayerId, currentLayerName, visible, stroke);

    if (node.tag === 'path' && node.attrs.d) {
      pushPathData(layer, node.attrs.d, matrix, elementId);
    } else if (node.tag === 'line') {
      const x1 = Number.parseFloat(node.attrs.x1 ?? '0');
      const y1 = Number.parseFloat(node.attrs.y1 ?? '0');
      const x2 = Number.parseFloat(node.attrs.x2 ?? '0');
      const y2 = Number.parseFloat(node.attrs.y2 ?? '0');
      pushPolyline(
        layer,
        [
          { x: x1, y: y1 },
          { x: x2, y: y2 },
        ],
        matrix,
        elementId,
        false,
      );
    } else if (node.tag === 'rect') {
      const x = Number.parseFloat(node.attrs.x ?? '0');
      const y = Number.parseFloat(node.attrs.y ?? '0');
      const w = Number.parseFloat(node.attrs.width ?? '0');
      const h = Number.parseFloat(node.attrs.height ?? '0');
      if (w > 0 && h > 0) {
        let rx = Number.parseFloat(node.attrs.rx ?? node.attrs.ry ?? '0');
        let ry = Number.parseFloat(node.attrs.ry ?? node.attrs.rx ?? '0');
        rx = Math.min(Math.max(0, rx), w / 2);
        ry = Math.min(Math.max(0, ry), h / 2);
        if (rx > 1e-6 && ry > 1e-6) {
          const d = [
            `M ${x + rx} ${y}`,
            `H ${x + w - rx}`,
            `A ${rx} ${ry} 0 0 1 ${x + w} ${y + ry}`,
            `V ${y + h - ry}`,
            `A ${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h}`,
            `H ${x + rx}`,
            `A ${rx} ${ry} 0 0 1 ${x} ${y + h - ry}`,
            `V ${y + ry}`,
            `A ${rx} ${ry} 0 0 1 ${x + rx} ${y}`,
            'Z',
          ].join(' ');
          pushPathData(layer, d, matrix, elementId);
        } else {
          pushPolyline(
            layer,
            [
              { x, y },
              { x: x + w, y },
              { x: x + w, y: y + h },
              { x, y: y + h },
            ],
            matrix,
            elementId,
            true,
          );
        }
      }
    } else if (node.tag === 'circle') {
      const cx = Number.parseFloat(node.attrs.cx ?? '0');
      const cy = Number.parseFloat(node.attrs.cy ?? '0');
      const r = Number.parseFloat(node.attrs.r ?? '0');
      if (r > 0) {
        const steps = Math.max(16, curveSteps * 2);
        const pts: Array<{ x: number; y: number }> = [];
        for (let i = 0; i < steps; i++) {
          const theta = (2 * Math.PI * i) / steps;
          pts.push({ x: cx + r * Math.cos(theta), y: cy + r * Math.sin(theta) });
        }
        pushPolyline(layer, pts, matrix, elementId, true);
      }
    } else if (node.tag === 'ellipse') {
      const cx = Number.parseFloat(node.attrs.cx ?? '0');
      const cy = Number.parseFloat(node.attrs.cy ?? '0');
      const rx = Number.parseFloat(node.attrs.rx ?? '0');
      const ry = Number.parseFloat(node.attrs.ry ?? '0');
      if (rx > 0 && ry > 0) {
        const steps = Math.max(16, curveSteps * 2);
        const pts: Array<{ x: number; y: number }> = [];
        for (let i = 0; i < steps; i++) {
          const theta = (2 * Math.PI * i) / steps;
          pts.push({ x: cx + rx * Math.cos(theta), y: cy + ry * Math.sin(theta) });
        }
        pushPolyline(layer, pts, matrix, elementId, true);
      }
    } else if (node.tag === 'polyline' || node.tag === 'polygon') {
      const nums = (node.attrs.points ?? '')
        .trim()
        .split(/[\s,]+/)
        .filter(Boolean)
        .map(Number);
      const pts: Array<{ x: number; y: number }> = [];
      for (let i = 0; i + 1 < nums.length; i += 2) {
        const px = nums[i];
        const py = nums[i + 1];
        if (px !== undefined && py !== undefined && Number.isFinite(px) && Number.isFinite(py)) {
          pts.push({ x: px, y: py });
        }
      }
      pushPolyline(layer, pts, matrix, elementId, node.tag === 'polygon');
    }

    for (const child of node.children) {
      walk(child, matrix, currentLayerId, currentLayerName, visible, stroke);
    }
  };

  walk(root, IDENTITY, 'default', 'Default', true, undefined);

  // Filter out empty layers
  const layers = Array.from(layerMap.values()).filter((l) => l.segments.length > 0);

  return {
    version: 1,
    units: 'mm',
    executable: false,
    layers,
    bounds: computeBounds(layers),
    metadata: {
      source: 'svg',
      dpi,
      flipY,
    },
  };
}
