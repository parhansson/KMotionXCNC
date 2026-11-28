import { z } from 'zod';

export const JobSourceSchema = z.object({
  path: z.string().min(1),
  format: z.enum(['gcode', 'svg', 'dxf', 'pdf', 'generator']),
  generatorId: z.string().optional(),
  generatorParams: z.record(z.unknown()).optional(),
});

export const MaterialPresetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  thicknessMm: z.number().nonnegative().optional(),
  feedRate: z.number().positive().optional(),
  passCount: z.number().int().positive().optional(),
  power: z.number().nonnegative().optional(),
  ppi: z.number().nonnegative().optional(),
});

export const JobOptimizeSchema = z.object({
  filterVisibleLayers: z.boolean().optional(),
  includeLayerIds: z.array(z.string()).optional(),
  scale: z
    .union([
      z.number().positive(),
      z.object({
        x: z.number().optional(),
        y: z.number().optional(),
        z: z.number().optional(),
      }),
    ])
    .optional(),
  rotateDeg: z.number().optional(),
  translateToOrigin: z
    .union([
      z.boolean(),
      z.object({
        x: z.boolean().optional(),
        y: z.boolean().optional(),
        z: z.boolean().optional(),
      }),
    ])
    .optional(),
  offset: z
    .object({
      x: z.number().optional(),
      y: z.number().optional(),
      z: z.number().optional(),
    })
    .optional(),
  removeSingularities: z.boolean().optional(),
  singularityToleranceMm: z.number().positive().optional(),
  joinAdjacent: z.boolean().optional(),
  joinToleranceMm: z.number().positive().optional(),
  shortestPath: z.boolean().optional(),
});

export const JobCamParamsSchema = z.object({
  postProcessorId: z.string().default('mill'),
  feedRate: z.number().positive().optional(),
  plungeFeedRate: z.number().positive().optional(),
  safeZ: z.number().optional(),
  cutZ: z.number().optional(),
  materialThickness: z.number().nonnegative().optional(),
  passCount: z.number().int().positive().optional(),
  fractionalDigits: z.number().int().min(0).max(6).optional(),
  initCode: z.array(z.string()).optional(),
  endCode: z.array(z.string()).optional(),
  unit: z.enum(['mm', 'in']).optional(),
  supportArcs: z.boolean().optional(),
  spindleSpeed: z.number().nonnegative().optional(),
  custom: z.record(z.unknown()).optional(),
});

/**
 * Zod schema for `*.kmxjob.json` project files.
 */
export const KmxJobSchema = z.object({
  version: z.literal(1),
  name: z.string().min(1),
  source: JobSourceSchema,
  visibleLayers: z.array(z.string()).optional(),
  materialPreset: MaterialPresetSchema.optional(),
  optimize: JobOptimizeSchema.optional(),
  cam: JobCamParamsSchema.default({ postProcessorId: 'mill' }),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type KmxJob = z.infer<typeof KmxJobSchema>;
export type JobSource = z.infer<typeof JobSourceSchema>;
export type MaterialPreset = z.infer<typeof MaterialPresetSchema>;
export type JobCamParams = z.infer<typeof JobCamParamsSchema>;

export function parseKmxJob(input: unknown): KmxJob {
  return KmxJobSchema.parse(input);
}

export function safeParseKmxJob(input: unknown) {
  return KmxJobSchema.safeParse(input);
}
