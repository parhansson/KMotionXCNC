import { z } from 'zod';

export const laserMaterialPresetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  ppiMcode: z.string().trim().min(1),
  feedRate: z.number().positive(),
  passes: z.number().int().min(1),
  thicknessMm: z.number().nonnegative(),
  notes: z.string().optional(),
});

export type LaserMaterialPreset = z.infer<typeof laserMaterialPresetSchema>;

export const laserMaterialListSchema = z.array(laserMaterialPresetSchema);

/**
 * Parses legacy feed rate strings like "F250" or numeric values into mm/min.
 */
export function parseFeedRateString(speed: string | number): number {
  if (typeof speed === 'number') {
    return Number.isFinite(speed) && speed > 0 ? speed : 250;
  }
  const match = speed.trim().match(/^F?\s*([0-9]+(?:\.[0-9]+)?)$/i);
  if (!match || !match[1]) {
    return 250;
  }
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 250;
}

export const DEFAULT_LASER_MATERIALS: readonly LaserMaterialPreset[] = [
  {
    id: 'polystyrene-2mm',
    name: 'Cut 2mm polystyrene',
    ppiMcode: 'M100 P900 Q100',
    feedRate: 250,
    passes: 1,
    thicknessMm: 2,
  },
  {
    id: 'acrylic-3mm',
    name: 'Cut 3mm acrylic',
    ppiMcode: 'M100 P1000 Q100',
    feedRate: 200,
    passes: 1,
    thicknessMm: 3,
  },
  {
    id: 'acrylic-6mm',
    name: 'Cut 6mm acrylic',
    ppiMcode: 'M100 P2200 Q100',
    feedRate: 90,
    passes: 1,
    thicknessMm: 6,
  },
  {
    id: 'plywood-4mm',
    name: 'Cut 4mm plywood',
    ppiMcode: 'M100 P300 Q100',
    feedRate: 250,
    passes: 1,
    thicknessMm: 4,
  },
  {
    id: 'pine-10mm',
    name: 'Cut 10mm pine',
    ppiMcode: 'M100 P900 Q100',
    feedRate: 50,
    passes: 1,
    thicknessMm: 10,
    notes: 'P900 down to P600 depending on resin content',
  },
  {
    id: 'hobby-plywood-3mm',
    name: 'Cut 3mm hobby plywood (multipass)',
    ppiMcode: 'M100 P700 Q100',
    feedRate: 150,
    passes: 3,
    thicknessMm: 3,
  },
  {
    id: 'paper-240g',
    name: 'Cut paper 220–240g',
    ppiMcode: 'M100 P400 Q100',
    feedRate: 1000,
    passes: 1,
    thicknessMm: 0.1,
  },
  {
    id: 'engrave-wood',
    name: 'Engrave wood / acrylic',
    ppiMcode: 'M100 P400 Q40',
    feedRate: 800,
    passes: 1,
    thicknessMm: 0,
  },
];
