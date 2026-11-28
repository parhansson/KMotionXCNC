import Decimal from 'decimal.js-light';
import { AXIS_NAMES, type Axes8, type AxisName } from '@kmxcnc/kmx-protocol';

export type LengthUnit = 'mm' | 'in';

export const MM_PER_INCH = 25.4;
const MM_PER_INCH_DEC = new Decimal(25.4);

export const DEFAULT_ROTARY_AXES: ReadonlySet<AxisName> = new Set<AxisName>(['A', 'B', 'C']);

/**
 * Exact mm -> inches conversion using decimal.js-light to avoid IEEE-754 boundary artifacts.
 */
export function mmToInches(mm: number | string): number {
  const val = new Decimal(mm);
  return val.div(MM_PER_INCH_DEC).toNumber();
}

/**
 * Exact inches -> mm conversion using decimal.js-light.
 */
export function inchesToMm(inches: number | string): number {
  const val = new Decimal(inches);
  return val.mul(MM_PER_INCH_DEC).toNumber();
}

/**
 * Converts a canonical mm value into the requested display unit.
 */
export function toDisplayUnit(mm: number, unit: LengthUnit): number {
  return unit === 'in' ? mmToInches(mm) : mm;
}

/**
 * Converts a user-entered value in `unit` into canonical mm.
 */
export function fromDisplayUnit(value: number | string, unit: LengthUnit): number {
  return unit === 'in' ? inchesToMm(value) : new Decimal(value).toNumber();
}

/**
 * Converts an 8-axis coordinate object from controller inches (linear axes) to canonical mm.
 * Rotary axes (by default A, B, C) pass through unchanged in degrees.
 */
export function controllerAxesToMm(
  axes: Readonly<Axes8>,
  rotaryAxes: ReadonlySet<AxisName> = DEFAULT_ROTARY_AXES,
): Axes8 {
  const out = {} as Axes8;
  for (const axis of AXIS_NAMES) {
    out[axis] = rotaryAxes.has(axis) ? axes[axis] : inchesToMm(axes[axis]);
  }
  return out;
}

/**
 * Converts an 8-axis coordinate object from canonical mm to controller inches (linear axes).
 * Rotary axes pass through unchanged in degrees.
 */
export function mmAxesToController(
  axes: Readonly<Axes8>,
  rotaryAxes: ReadonlySet<AxisName> = DEFAULT_ROTARY_AXES,
): Axes8 {
  const out = {} as Axes8;
  for (const axis of AXIS_NAMES) {
    out[axis] = rotaryAxes.has(axis) ? axes[axis] : mmToInches(axes[axis]);
  }
  return out;
}

/**
 * Formats a canonical mm value for DRO / UI display in the selected unit.
 */
export function formatCoord(
  mm: number,
  unit: LengthUnit,
  decimals?: number,
): string {
  const converted = toDisplayUnit(mm, unit);
  const digits = decimals ?? (unit === 'in' ? 4 : 3);
  const safe = Object.is(converted, -0) ? 0 : converted;
  return safe.toFixed(digits);
}

/**
 * Formats a single axis value (linear axes converted to `unit`, rotary axes formatted in degrees).
 */
export function formatAxisValue(
  axis: AxisName,
  value: number,
  unit: LengthUnit,
  rotaryAxes: ReadonlySet<AxisName> = DEFAULT_ROTARY_AXES,
  decimals?: number,
): string {
  if (rotaryAxes.has(axis)) {
    const safe = Object.is(value, -0) ? 0 : value;
    return safe.toFixed(decimals ?? 3);
  }
  return formatCoord(value, unit, decimals);
}

export function getAxisUnitLabel(
  axis: AxisName,
  unit: LengthUnit,
  rotaryAxes: ReadonlySet<AxisName> = DEFAULT_ROTARY_AXES,
): string {
  return rotaryAxes.has(axis) ? 'deg' : unit;
}
