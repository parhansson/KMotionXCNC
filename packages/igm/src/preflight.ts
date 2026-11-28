import { computeBounds, computeSegmentLength } from './bounds';
import { AXES, type AxisName, type Bounds8, type IgmDocument } from './types';

export interface MachineLimits {
  /** Machine work envelope dimensions in mm. */
  dimX?: number;
  dimY?: number;
  dimZ?: number;
  /** Per-axis negative soft limits in mm (or degrees for rotary A/B/C). */
  softLimitNeg?: Partial<Record<AxisName, number>>;
  /** Per-axis positive soft limits in mm (or degrees for rotary A/B/C). */
  softLimitPos?: Partial<Record<AxisName, number>>;
  /** Rapid traverse feed rate in mm/min used for time estimation (default: 3000). */
  rapidFeedRateMmPerMin?: number;
  /** Default cut feed rate in mm/min when a cut segment lacks feedRate (default: 600). */
  defaultCutFeedRateMmPerMin?: number;
}

export type PreflightIssueCode =
  | 'EMPTY_DOCUMENT'
  | 'SOFT_LIMIT_MIN_EXCEEDED'
  | 'SOFT_LIMIT_MAX_EXCEEDED'
  | 'ENVELOPE_EXCEEDED'
  | 'ENVELOPE_ORIGIN_WARNING'
  | 'MISSING_FEED_RATE';

export interface PreflightIssue {
  code: PreflightIssueCode;
  severity: 'error' | 'warning';
  axis?: AxisName;
  message: string;
  actual?: number;
  limit?: number;
}

export interface PreflightResult {
  ok: boolean;
  warnings: PreflightIssue[];
  errors: PreflightIssue[];
  bounds: Bounds8;
  rapidDistanceMm: number;
  cutDistanceMm: number;
  geometryDistanceMm: number;
  totalDistanceMm: number;
  estimatedTimeSec: number;
  segmentCount: number;
}

const DEFAULT_RAPID_FEED_MM_PER_MIN = 3000;
const DEFAULT_CUT_FEED_MM_PER_MIN = 600;

export function analyzePreflight(
  doc: IgmDocument,
  limits: MachineLimits = {},
): PreflightResult {
  const warnings: PreflightIssue[] = [];
  const errors: PreflightIssue[] = [];

  const bounds = computeBounds(doc, { visibleOnly: true });
  const rapidFeed =
    limits.rapidFeedRateMmPerMin && limits.rapidFeedRateMmPerMin > 0
      ? limits.rapidFeedRateMmPerMin
      : DEFAULT_RAPID_FEED_MM_PER_MIN;
  const defaultCutFeed =
    limits.defaultCutFeedRateMmPerMin && limits.defaultCutFeedRateMmPerMin > 0
      ? limits.defaultCutFeedRateMmPerMin
      : DEFAULT_CUT_FEED_MM_PER_MIN;

  let rapidDistanceMm = 0;
  let cutDistanceMm = 0;
  let geometryDistanceMm = 0;
  let estimatedTimeMin = 0;
  let segmentCount = 0;
  let missingFeedCount = 0;

  for (const layer of doc.layers) {
    if (!layer.visible) continue;
    for (const seg of layer.segments) {
      segmentCount += 1;
      const dist = computeSegmentLength(seg);
      if (seg.kind === 'rapid') {
        rapidDistanceMm += dist;
        estimatedTimeMin += dist / rapidFeed;
      } else if (seg.kind === 'cut') {
        cutDistanceMm += dist;
        const feed = seg.feedRate && seg.feedRate > 0 ? seg.feedRate : defaultCutFeed;
        if (!seg.feedRate || seg.feedRate <= 0) {
          missingFeedCount += 1;
        }
        estimatedTimeMin += dist / feed;
      } else {
        geometryDistanceMm += dist;
        const feed = seg.feedRate && seg.feedRate > 0 ? seg.feedRate : defaultCutFeed;
        estimatedTimeMin += dist / feed;
      }
    }
  }

  if (bounds.empty || segmentCount === 0) {
    warnings.push({
      code: 'EMPTY_DOCUMENT',
      severity: 'warning',
      message: 'Document contains no visible segments.',
    });
  } else {
    // Check per-axis soft limits (all 8 axes)
    for (const axis of AXES) {
      const minVal = bounds.min[axis];
      const maxVal = bounds.max[axis];
      if (minVal === undefined || maxVal === undefined) continue;

      const negLimit = limits.softLimitNeg?.[axis];
      if (negLimit !== undefined && Number.isFinite(negLimit) && minVal < negLimit - 1e-6) {
        errors.push({
          code: 'SOFT_LIMIT_MIN_EXCEEDED',
          severity: 'error',
          axis,
          actual: minVal,
          limit: negLimit,
          message: `Axis ${axis.toUpperCase()} minimum (${minVal.toFixed(3)}) is below soft limit (${negLimit.toFixed(3)}).`,
        });
      }

      const posLimit = limits.softLimitPos?.[axis];
      if (posLimit !== undefined && Number.isFinite(posLimit) && maxVal > posLimit + 1e-6) {
        errors.push({
          code: 'SOFT_LIMIT_MAX_EXCEEDED',
          severity: 'error',
          axis,
          actual: maxVal,
          limit: posLimit,
          message: `Axis ${axis.toUpperCase()} maximum (${maxVal.toFixed(3)}) exceeds soft limit (${posLimit.toFixed(3)}).`,
        });
      }
    }

    // Check machine work envelope dimensions (dimX / dimY / dimZ)
    const envelopeChecks: ReadonlyArray<{ axis: 'x' | 'y' | 'z'; dim: number | undefined }> = [
      { axis: 'x', dim: limits.dimX },
      { axis: 'y', dim: limits.dimY },
      { axis: 'z', dim: limits.dimZ },
    ];

    for (const { axis, dim } of envelopeChecks) {
      if (dim === undefined || !Number.isFinite(dim) || dim <= 0) continue;
      const minVal = bounds.min[axis];
      const maxVal = bounds.max[axis];
      const span = maxVal - minVal;

      if (span > dim + 1e-6) {
        errors.push({
          code: 'ENVELOPE_EXCEEDED',
          severity: 'error',
          axis,
          actual: span,
          limit: dim,
          message: `Axis ${axis.toUpperCase()} span (${span.toFixed(3)} mm) exceeds machine envelope (${dim.toFixed(3)} mm).`,
        });
      } else if (
        limits.softLimitNeg?.[axis] === undefined &&
        limits.softLimitPos?.[axis] === undefined &&
        (minVal < -1e-6 || maxVal > dim + 1e-6)
      ) {
        warnings.push({
          code: 'ENVELOPE_ORIGIN_WARNING',
          severity: 'warning',
          axis,
          actual: maxVal > dim ? maxVal : minVal,
          limit: maxVal > dim ? dim : 0,
          message: `Axis ${axis.toUpperCase()} range [${minVal.toFixed(3)}, ${maxVal.toFixed(3)}] extends outside [0, ${dim.toFixed(3)}] mm (verify work origin).`,
        });
      }
    }
  }

  if (missingFeedCount > 0) {
    warnings.push({
      code: 'MISSING_FEED_RATE',
      severity: 'warning',
      message: `${missingFeedCount} cut segment(s) had no explicit feed rate; estimated using ${defaultCutFeed} mm/min.`,
    });
  }

  return {
    ok: errors.length === 0,
    warnings,
    errors,
    bounds,
    rapidDistanceMm,
    cutDistanceMm,
    geometryDistanceMm,
    totalDistanceMm: rapidDistanceMm + cutDistanceMm + geometryDistanceMm,
    estimatedTimeSec: estimatedTimeMin * 60,
    segmentCount,
  };
}
