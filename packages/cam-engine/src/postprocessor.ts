import {
  type ArcSegment,
  type IgmDocument,
  type IgmSegment,
  getArcGeometry,
} from '@kmxcnc/igm';

export interface PostProcessorParams {
  /** Cutting feed rate in mm/min (default: 600). */
  feedRate?: number;
  /** Plunge feed rate in mm/min (defaults to feedRate). */
  plungeFeedRate?: number;
  /** Safe retract Z height in mm (default: 5). */
  safeZ?: number;
  /** Target cut Z depth in mm (default: -1). */
  cutZ?: number;
  /** Total material thickness in mm for multipass (positive number, optional). */
  materialThickness?: number;
  /** Number of depth passes (default: 1). */
  passCount?: number;
  /** Decimal digits for formatted coordinates (default: 3). */
  fractionalDigits?: number;
  /** G-code lines emitted at the start of the program. */
  initCode?: string[];
  /** G-code lines emitted at the end of the program. */
  endCode?: string[];
  /** Output unit mode: 'mm' (G21) or 'in' (G20). Default: 'mm'. */
  unit?: 'mm' | 'in';
  /** Emit native G2/G3 arcs (true) or linearize arcs into G1 segments (false). Default: true. */
  supportArcs?: boolean;
  /** Optional spindle speed (emits S<value> M3). */
  spindleSpeed?: number;
  /** Arbitrary plugin-specific parameters (e.g., laser power/PPI). */
  custom?: Record<string, unknown>;
}

export interface PostProcessor {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  generate(doc: IgmDocument, params?: PostProcessorParams): string;
}

const MM_PER_INCH = 25.4;

function formatNum(val: number, digits: number): string {
  const fixed = val.toFixed(digits);
  // Avoid "-0.000"
  if (/^-0(\.0+)?$/.test(fixed)) {
    return (0).toFixed(digits).replace(/\.?0+$/, '') || '0';
  }
  return digits > 0 ? fixed.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '') : fixed;
}

function linearizeArc(seg: ArcSegment, stepsPerQuadrant = 8): Array<{ x: number; y: number; z: number }> {
  const { cu, cv, radius, startAngle, sweep, axes } = getArcGeometry(seg);
  const steps = Math.max(4, Math.ceil((Math.abs(sweep) / (Math.PI / 2)) * stepsPerQuadrant));
  const wStart = seg.start[axes.w];
  const wEnd = seg.end[axes.w];
  const pts: Array<{ x: number; y: number; z: number }> = [];

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const angle = startAngle + sweep * t;
    const pt = { x: 0, y: 0, z: 0 };
    pt[axes.u] = cu + radius * Math.cos(angle);
    pt[axes.v] = cv + radius * Math.sin(angle);
    pt[axes.w] = wStart + (wEnd - wStart) * t;
    pts.push(pt);
  }
  return pts;
}

function computePassDepths(params: PostProcessorParams): number[] {
  const passCount = Math.max(1, Math.floor(params.passCount ?? 1));
  if (params.materialThickness !== undefined && params.materialThickness > 0) {
    const totalDepth = -Math.abs(params.materialThickness);
    const depths: number[] = [];
    for (let i = 1; i <= passCount; i++) {
      depths.push((totalDepth * i) / passCount);
    }
    return depths;
  }
  const cutZ = params.cutZ ?? -1;
  if (passCount <= 1) return [cutZ];
  const depths: number[] = [];
  for (let i = 1; i <= passCount; i++) {
    depths.push((cutZ * i) / passCount);
  }
  return depths;
}

export class MillPostProcessor implements PostProcessor {
  readonly id = 'mill';
  readonly name = 'Standard Mill';
  readonly description = '3–8 axis CNC mill/router postprocessor supporting arcs and multipass Z';

  generate(doc: IgmDocument, params: PostProcessorParams = {}): string {
    const unit = params.unit ?? 'mm';
    const scale = unit === 'in' ? 1 / MM_PER_INCH : 1;
    const digits = params.fractionalDigits ?? 3;
    const feedMm = params.feedRate ?? 600;
    const plungeFeedMm = params.plungeFeedRate ?? feedMm;
    const safeZMm = params.safeZ ?? 5;
    const supportArcs = params.supportArcs ?? true;

    const fmt = (mmVal: number) => formatNum(mmVal * scale, digits);
    const fmtRaw = (val: number) => formatNum(val, digits);

    const lines: string[] = [];
    lines.push(unit === 'in' ? 'G20' : 'G21');
    lines.push('G90');
    lines.push('G17');

    if (params.initCode) {
      for (const line of params.initCode) {
        if (line.trim()) lines.push(line);
      }
    }

    if (params.spindleSpeed !== undefined && params.spindleSpeed > 0) {
      lines.push(`S${fmtRaw(params.spindleSpeed)} M3`);
    }

    const visibleSegments: IgmSegment[] = [];
    for (const layer of doc.layers) {
      if (!layer.visible) continue;
      for (const seg of layer.segments) {
        visibleSegments.push(seg);
      }
    }

    if (visibleSegments.length === 0) {
      if (params.endCode) {
        for (const line of params.endCode) {
          if (line.trim()) lines.push(line);
        }
      } else {
        lines.push('M2');
      }
      return lines.join('\n') + '\n';
    }

    // If document is already executable and user didn't specify multipass/cutZ override,
    // emit segments directly preserving Z, rapids, and 8-axis coordinates.
    const preserveExecutable =
      doc.executable &&
      params.cutZ === undefined &&
      params.materialThickness === undefined &&
      (params.passCount === undefined || params.passCount <= 1);

    if (preserveExecutable) {
      let currentPlane = 'G17';
      let currentFeed: number | undefined;

      for (const seg of visibleSegments) {
        if (seg.type === 'line') {
          const cmd = seg.kind === 'rapid' ? 'G0' : 'G1';
          const parts = [
            cmd,
            `X${fmt(seg.end.x)}`,
            `Y${fmt(seg.end.y)}`,
            `Z${fmt(seg.end.z)}`,
          ];
          if (seg.end.a !== undefined) parts.push(`A${fmtRaw(seg.end.a)}`);
          if (seg.end.b !== undefined) parts.push(`B${fmtRaw(seg.end.b)}`);
          if (seg.end.c !== undefined) parts.push(`C${fmtRaw(seg.end.c)}`);
          if (seg.end.u !== undefined) parts.push(`U${fmt(seg.end.u)}`);
          if (seg.end.v !== undefined) parts.push(`V${fmt(seg.end.v)}`);
          if (seg.kind !== 'rapid') {
            const f = seg.feedRate ?? feedMm;
            if (f !== currentFeed) {
              parts.push(`F${fmt(f)}`);
              currentFeed = f;
            }
          }
          lines.push(parts.join(' '));
        } else {
          if (seg.plane !== currentPlane) {
            lines.push(seg.plane);
            currentPlane = seg.plane;
          }
          const f = seg.feedRate ?? feedMm;
          if (!supportArcs) {
            const pts = linearizeArc(seg);
            for (const p of pts) {
              const parts = ['G1', `X${fmt(p.x)}`, `Y${fmt(p.y)}`, `Z${fmt(p.z)}`];
              if (f !== currentFeed) {
                parts.push(`F${fmt(f)}`);
                currentFeed = f;
              }
              lines.push(parts.join(' '));
            }
          } else {
            const cmd = seg.clockwise ? 'G2' : 'G3';
            const iOff = seg.center.x - seg.start.x;
            const jOff = seg.center.y - seg.start.y;
            const kOff = (seg.center.z ?? seg.start.z) - seg.start.z;
            const parts = [
              cmd,
              `X${fmt(seg.end.x)}`,
              `Y${fmt(seg.end.y)}`,
              `Z${fmt(seg.end.z)}`,
            ];
            if (seg.plane === 'G17') {
              parts.push(`I${fmt(iOff)}`, `J${fmt(jOff)}`);
            } else if (seg.plane === 'G18') {
              parts.push(`I${fmt(iOff)}`, `K${fmt(kOff)}`);
            } else {
              parts.push(`J${fmt(jOff)}`, `K${fmt(kOff)}`);
            }
            if (f !== currentFeed) {
              parts.push(`F${fmt(f)}`);
              currentFeed = f;
            }
            lines.push(parts.join(' '));
          }
        }
      }
    } else {
      // CAD / CAM geometry mode with safeZ, plunge, and multipass Z
      const passDepths = computePassDepths(params);
      lines.push(`G0 Z${fmt(safeZMm)}`);

      for (const passZ of passDepths) {
        let curX = Number.NaN;
        let curY = Number.NaN;
        let isDown = false;

        for (const seg of visibleSegments) {
          const connected =
            isDown &&
            Math.hypot(seg.start.x - curX, seg.start.y - curY) <= 1e-3;

          if (!connected) {
            if (isDown) {
              lines.push(`G0 Z${fmt(safeZMm)}`);
            }
            lines.push(`G0 X${fmt(seg.start.x)} Y${fmt(seg.start.y)}`);
            lines.push(`G1 Z${fmt(passZ)} F${fmt(plungeFeedMm)}`);
            isDown = true;
          }

          if (seg.type === 'line') {
            lines.push(
              `G1 X${fmt(seg.end.x)} Y${fmt(seg.end.y)} F${fmt(seg.feedRate ?? feedMm)}`,
            );
          } else if (!supportArcs) {
            const pts = linearizeArc(seg);
            for (const p of pts) {
              lines.push(
                `G1 X${fmt(p.x)} Y${fmt(p.y)} F${fmt(seg.feedRate ?? feedMm)}`,
              );
            }
          } else {
            const cmd = seg.clockwise ? 'G2' : 'G3';
            const iOff = seg.center.x - seg.start.x;
            const jOff = seg.center.y - seg.start.y;
            lines.push(
              `${cmd} X${fmt(seg.end.x)} Y${fmt(seg.end.y)} I${fmt(iOff)} J${fmt(jOff)} F${fmt(seg.feedRate ?? feedMm)}`,
            );
          }

          curX = seg.end.x;
          curY = seg.end.y;
        }

        if (isDown) {
          lines.push(`G0 Z${fmt(safeZMm)}`);
        }
      }
    }

    if (params.spindleSpeed !== undefined && params.spindleSpeed > 0) {
      lines.push('M5');
    }

    if (params.endCode && params.endCode.length > 0) {
      for (const line of params.endCode) {
        if (line.trim()) lines.push(line);
      }
    } else {
      lines.push('M2');
    }

    return lines.join('\n') + '\n';
  }
}

export class PostProcessorRegistry {
  private readonly processors = new Map<string, PostProcessor>();

  constructor(initial?: PostProcessor[]) {
    if (initial) {
      for (const p of initial) {
        this.register(p);
      }
    }
  }

  register(processor: PostProcessor): void {
    this.processors.set(processor.id, processor);
  }

  unregister(id: string): boolean {
    return this.processors.delete(id);
  }

  get(id: string): PostProcessor | undefined {
    return this.processors.get(id);
  }

  has(id: string): boolean {
    return this.processors.has(id);
  }

  list(): PostProcessor[] {
    return Array.from(this.processors.values());
  }
}

export const defaultPostProcessorRegistry = new PostProcessorRegistry([
  new MillPostProcessor(),
]);

/**
 * Generates G-code from an IGM document using the named postprocessor (default: 'mill').
 */
export function igmToGcode(
  doc: IgmDocument,
  params?: PostProcessorParams,
  postProcessorId = 'mill',
  registry: PostProcessorRegistry = defaultPostProcessorRegistry,
): string {
  const pp = registry.get(postProcessorId);
  if (!pp) {
    throw new Error(`Unknown postprocessor: "${postProcessorId}"`);
  }
  return pp.generate(doc, params);
}
