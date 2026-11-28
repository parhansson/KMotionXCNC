import type { ArcSegment, IgmDocument, Vec8 } from '@kmxcnc/igm';
import type { PostProcessor, PostProcessorParams } from '@kmxcnc/cam-engine';
import type { FormFieldSchema, PluginPostProcessor } from '@kmxcnc/plugin-sdk';

export interface LaserPostProcessorOptions {
  /** Feed rate in mm/min (converted to in/min when unit === 'in'). */
  feedRate?: number;
  /** Laser PPI M-code emitted at program start, e.g. 'M100 P1000 Q100'. */
  ppiMcode?: string;
  /** M-code to fire laser at the start of a cut segment (default 'M3'). */
  laserOnCode?: string;
  /** M-code to extinguish laser before rapid moves and at program end (default 'M5'). */
  laserOffCode?: string;
  /** Output G-code unit ('mm' -> G21, 'in' -> G20). */
  unit?: 'mm' | 'in';
  /** Number of fractional digits for coordinates. */
  fractionalDigits?: number;
  /** Enable multipass cutting. */
  multipass?: boolean;
  /** Total number of passes (used when multipass is true or passes > 1). */
  passes?: number;
  /** Alias for `passes` matching cam-engine PostProcessorParams. */
  passCount?: number;
  /** Optional Z step-down per pass in mm (0 keeps Z fixed). */
  zStepPerPassMm?: number;
  /** Optional starting Z focus height in mm. */
  cutZ?: number;
  /** Optional safe Z height in mm. */
  safeZ?: number;
  /** Optional extra header G-code lines. */
  initCode?: string | string[];
  /** End-of-program M-code (default 'M2'). */
  endCode?: string | string[];
  /** Return to X0 Y0 at end of job (default true). */
  returnHome?: boolean;
  /** Optional custom bag from PostProcessorParams. */
  custom?: Record<string, unknown>;
}

const MM_PER_INCH = 25.4;
const CONTIGUOUS_EPSILON_MM = 1e-4;

function isSameXY(a: Vec8 | null, b: Vec8): boolean {
  if (!a) return false;
  return (
    Math.abs(a.x - b.x) <= CONTIGUOUS_EPSILON_MM &&
    Math.abs(a.y - b.y) <= CONTIGUOUS_EPSILON_MM
  );
}

function fmt(value: number, scale: number, digits: number): string {
  const scaled = value * scale;
  const rounded = Object.is(Number(scaled.toFixed(digits)), -0)
    ? 0
    : Number(scaled.toFixed(digits));
  return rounded.toFixed(digits).replace(/\.?0+$/, '');
}

function emitArcCommand(
  seg: ArcSegment,
  scale: number,
  digits: number,
): string {
  const code = seg.clockwise ? 'G2' : 'G3';
  const x = fmt(seg.end.x, scale, digits);
  const y = fmt(seg.end.y, scale, digits);
  const i = fmt(seg.center.x - seg.start.x, scale, digits);
  const j = fmt(seg.center.y - seg.start.y, scale, digits);
  return `${code} X${x} Y${y} I${i} J${j}`;
}

export const LASER_POSTPROCESSOR_FIELDS: readonly FormFieldSchema[] = [
  {
    name: 'ppiMcode',
    label: 'Laser PPI M-Code',
    type: 'string',
    defaultValue: 'M100 P1000 Q100',
    placeholder: 'M100 P1000 Q100',
    order: 1,
  },
  {
    name: 'feedRate',
    label: 'Feed Rate',
    type: 'number',
    defaultValue: 250,
    unit: 'mm/min',
    min: 1,
    order: 2,
  },
  {
    name: 'passes',
    label: 'Passes',
    type: 'number',
    defaultValue: 1,
    min: 1,
    max: 50,
    step: 1,
    order: 3,
  },
  {
    name: 'zStepPerPassMm',
    label: 'Z Focus Step per Pass',
    type: 'number',
    defaultValue: 0,
    unit: 'mm',
    step: 0.5,
    order: 4,
  },
  {
    name: 'laserOnCode',
    label: 'Laser On Code',
    type: 'string',
    defaultValue: 'M3',
    order: 5,
  },
  {
    name: 'laserOffCode',
    label: 'Laser Off Code',
    type: 'string',
    defaultValue: 'M5',
    order: 6,
  },
];

/**
 * Converts an IGM document into KMotionX laser G-code with `M100 P... Q...`,
 * per-segment laser on/off (`M3`/`M5`), and multipass support.
 */
export function laserIgmToGcode(
  doc: IgmDocument,
  options: LaserPostProcessorOptions = {},
): string {
  const custom = options.custom ?? {};
  const unit = options.unit ?? 'mm';
  const scale = unit === 'in' ? 1 / MM_PER_INCH : 1;
  const digits = options.fractionalDigits ?? 3;
  const feedRate = options.feedRate ?? 250;
  const ppiMcode = String(
    options.ppiMcode ?? custom['ppiMcode'] ?? 'M100 P1000 Q100',
  ).trim();
  const laserOn = String(
    options.laserOnCode ?? custom['laserOnCode'] ?? 'M3',
  ).trim();
  const laserOff = String(
    options.laserOffCode ?? custom['laserOffCode'] ?? 'M5',
  ).trim();
  const endLines = Array.isArray(options.endCode)
    ? options.endCode
    : [options.endCode ?? 'M2'];
  const returnHome = options.returnHome ?? true;
  const requestedPasses = options.passes ?? options.passCount ?? 1;
  const passCount =
    options.multipass === false ? 1 : Math.max(1, Math.floor(requestedPasses));
  const zStepPerPassMm = Number(
    options.zStepPerPassMm ?? custom['zStepPerPassMm'] ?? 0,
  );
  const baseCutZ = options.cutZ ?? 0;

  const lines: string[] = [];
  lines.push('G90');
  lines.push(unit === 'in' ? 'G20' : 'G21');
  if (ppiMcode.length > 0) {
    lines.push(ppiMcode);
  }
  const initLines = Array.isArray(options.initCode)
    ? options.initCode
    : options.initCode
      ? options.initCode.split(/\r?\n/)
      : [];
  for (const extra of initLines) {
    const trimmed = extra.trim();
    if (trimmed.length > 0) lines.push(trimmed);
  }
  lines.push(`F${fmt(feedRate, scale, digits)}`);
  lines.push(laserOff);

  const visibleLayers = doc.layers.filter((layer) => layer.visible);
  let laserActive = false;
  let currentPos: Vec8 | null = null;

  const ensureLaserOff = () => {
    if (laserActive) {
      lines.push(laserOff);
      laserActive = false;
    }
  };

  const ensureLaserOn = () => {
    if (!laserActive) {
      lines.push(laserOn);
      laserActive = true;
    }
  };

  for (let pass = 0; pass < passCount; pass++) {
    if (passCount > 1) {
      lines.push(`(Pass ${pass + 1} of ${passCount})`);
    }
    const passZ = baseCutZ - pass * zStepPerPassMm;
    if (pass > 0 && zStepPerPassMm !== 0) {
      ensureLaserOff();
      lines.push(`G0 Z${fmt(passZ, scale, digits)}`);
    } else if (pass === 0 && options.cutZ !== undefined) {
      lines.push(`G0 Z${fmt(passZ, scale, digits)}`);
    }

    for (const layer of visibleLayers) {
      if (layer.segments.length === 0) continue;
      lines.push(`(Layer: ${layer.name || layer.id})`);

      for (const seg of layer.segments) {
        if (seg.kind === 'rapid') {
          ensureLaserOff();
          lines.push(
            `G0 X${fmt(seg.end.x, scale, digits)} Y${fmt(seg.end.y, scale, digits)}`,
          );
          currentPos = seg.end;
          continue;
        }

        // If disconnected from previous cut endpoint, turn laser off and rapid to segment start
        if (!isSameXY(currentPos, seg.start)) {
          ensureLaserOff();
          lines.push(
            `G0 X${fmt(seg.start.x, scale, digits)} Y${fmt(seg.start.y, scale, digits)}`,
          );
          currentPos = seg.start;
        }

        ensureLaserOn();

        if (seg.type === 'arc') {
          lines.push(emitArcCommand(seg, scale, digits));
        } else {
          lines.push(
            `G1 X${fmt(seg.end.x, scale, digits)} Y${fmt(seg.end.y, scale, digits)}`,
          );
        }
        currentPos = seg.end;
      }
    }
  }

  ensureLaserOff();
  if (returnHome) {
    lines.push('G0 X0 Y0');
  }
  for (const endLine of endLines) {
    const trimmed = endLine.trim();
    if (trimmed.length > 0) lines.push(trimmed);
  }

  return lines.join('\n') + '\n';
}

export class LaserPostProcessor implements PostProcessor, PluginPostProcessor {
  readonly id = 'laser-ppi';
  readonly name = 'Laser PPI (M100)';
  readonly description =
    'Generates KMotionX laser G-code with M100 PPI control, M3/M5 per cut segment, and multipass support.';
  readonly paramsSchema: FormFieldSchema[] = [...LASER_POSTPROCESSOR_FIELDS];

  process(doc: IgmDocument, params?: Record<string, unknown>): string {
    return laserIgmToGcode(doc, (params ?? {}) as LaserPostProcessorOptions);
  }

  generate(
    doc: IgmDocument,
    params?: PostProcessorParams | LaserPostProcessorOptions,
  ): string {
    return laserIgmToGcode(doc, params as LaserPostProcessorOptions | undefined);
  }
}

export const laserPostProcessor = new LaserPostProcessor();
