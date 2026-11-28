import { z } from 'zod';
import { AXIS_NAMES } from '@kmxcnc/kmx-protocol';

/**
 * Accepts both JSON numbers and numeric strings (legacy `machine.json` files store some numbers as strings).
 */
export const NumericValueSchema = z
  .union([
    z.number(),
    z
      .string()
      .trim()
      .min(1)
      .transform((s, ctx) => {
        const parsed = Number(s);
        if (!Number.isFinite(parsed)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Invalid numeric string: "${s}"`,
          });
          return z.NEVER;
        }
        return parsed;
      }),
  ])
  .pipe(z.number().finite());

export const OptionalNumericSchema = NumericValueSchema.optional();

export const AxisNameSchema = z.enum(AXIS_NAMES);

export const AxisConfigSchema = z
  .object({
    name: AxisNameSchema,
    countsPerUnit: OptionalNumericSchema,
    maxAccel: OptionalNumericSchema,
    maxVel: OptionalNumericSchema,
    jogVel: OptionalNumericSchema,
    /** Extended MOTION_PARAMS fields */
    softLimitNeg: OptionalNumericSchema,
    softLimitPos: OptionalNumericSchema,
    /** Maps to DegreesA/B/C in KMotionX MOTION_PARAMS */
    degrees: z.boolean().optional(),
    /** Maps to RadiusA/B/C in KMotionX MOTION_PARAMS */
    radius: OptionalNumericSchema,
    /** Maps to MaxJerkX..V in 3rd-order trajectory planner */
    maxJerk: OptionalNumericSchema,
    enabled: z.boolean().optional(),
    diameterMode: z.boolean().optional(),
  })
  .passthrough();

export type AxisConfig = z.infer<typeof AxisConfigSchema>;

export const TrajectoryPlannerSchema = z
  .object({
    breakangle: NumericValueSchema.default(5),
    cornertolerance: NumericValueSchema.default(0.003),
    lookahead: NumericValueSchema.default(3),
    collineartolerance: NumericValueSchema.default(0.0005),
    facetangle: NumericValueSchema.default(0.5),
    /** Extended 3rd-order & planner options */
    thirdOrderTP: z.boolean().optional(),
    cubicKnots: z.boolean().optional(),
    arcsToSegs: z.boolean().optional(),
    useOnlyLinearSegments: z.boolean().optional(),
    doRapidsAsFeeds: z.boolean().optional(),
    maxRapidFRO: OptionalNumericSchema,
    maxLinearLength: OptionalNumericSchema,
    maxAngularChange: OptionalNumericSchema,
    tcpActive: z.boolean().optional(),
    tcpX: OptionalNumericSchema,
    tcpY: OptionalNumericSchema,
    tcpZ: OptionalNumericSchema,
  })
  .passthrough();

export type TrajectoryPlannerConfig = z.infer<typeof TrajectoryPlannerSchema>;

export const MachineActionSchema = z
  .object({
    action: NumericValueSchema.default(0),
    name: z.string().optional(),
    file: z.string().optional(),
    dParam0: OptionalNumericSchema,
    dParam1: OptionalNumericSchema,
    dParam2: OptionalNumericSchema,
    dParam3: OptionalNumericSchema,
    dParam4: OptionalNumericSchema,
    /** Optional UI metadata for custom operator buttons */
    hotkey: z.string().optional(),
    icon: z.string().optional(),
    color: z.string().optional(),
    tooltip: z.string().optional(),
  })
  .passthrough();

export type MachineActionConfig = z.infer<typeof MachineActionSchema>;

export const MachineConfigSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().default(''),
    dimX: NumericValueSchema,
    dimY: NumericValueSchema,
    dimZ: NumericValueSchema,
    defaultUnit: z.enum(['mm', 'in']).default('mm'),
    axes: z.array(AxisConfigSchema).min(1).max(8),
    tplanner: TrajectoryPlannerSchema,
    actions: z.array(MachineActionSchema).default([]),
    specialActions: z.array(MachineActionSchema).default([]),
    extendedActions: z.array(MachineActionSchema).default([]),
    userActions: z.array(MachineActionSchema).default([]),
    /** Extensible KMXCNC fields */
    uiProfile: z.string().optional(),
    enabledPlugins: z.array(z.string()).optional(),
    /** Optional top-level KMotionX MOTION_PARAMS aliases for backwards/forwards compatibility */
    DegreesA: z.boolean().optional(),
    DegreesB: z.boolean().optional(),
    DegreesC: z.boolean().optional(),
    RadiusA: OptionalNumericSchema,
    RadiusB: OptionalNumericSchema,
    RadiusC: OptionalNumericSchema,
    ThirdOrderTP: z.boolean().optional(),
  })
  .passthrough();

export type MachineConfig = z.infer<typeof MachineConfigSchema>;

export const CustomControlSchema = z
  .object({
    id: z.string().min(1),
    kind: z.enum(['button', 'toggle', 'input', 'dropdown', 'indicator']),
    label: z.string(),
    actionIndex: z.number().int().optional(),
    gcode: z.string().optional(),
    ioBit: z.number().int().optional(),
    persistVar: z.number().int().optional(),
    hotkey: z.string().optional(),
    icon: z.string().optional(),
    color: z.string().optional(),
    tooltip: z.string().optional(),
    options: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
  })
  .passthrough();

export type CustomControlConfig = z.infer<typeof CustomControlSchema>;

export const UiLayoutSchema = z
  .object({
    version: z.number().int().default(1),
    profileId: z.string().default('mill-3axis'),
    theme: z.enum(['dark', 'light']).default('dark'),
    density: z.enum(['desktop', 'touch']).default('desktop'),
    visibleAxes: z.array(AxisNameSchema).optional(),
    diameterMode: z.boolean().optional(),
    /** Serialized Dockview JSON layout or Grid panel placement */
    dockviewLayout: z.record(z.unknown()).optional(),
    hiddenWidgets: z.array(z.string()).optional(),
    customControls: z.array(CustomControlSchema).optional(),
  })
  .passthrough();

export type UiLayoutConfig = z.infer<typeof UiLayoutSchema>;

export function parseMachineConfig(input: unknown): MachineConfig {
  return MachineConfigSchema.parse(input);
}

export function safeParseMachineConfig(input: unknown) {
  return MachineConfigSchema.safeParse(input);
}

export function parseUiLayout(input: unknown): UiLayoutConfig {
  return UiLayoutSchema.parse(input);
}
