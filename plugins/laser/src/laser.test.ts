import { describe, expect, it } from 'vitest';
import type { IgmDocument } from '@kmxcnc/igm';
import {
  calculateLaserPpi,
  DEFAULT_LASER_MATERIALS,
  formatM100PpiCommand,
  laserIgmToGcode,
  laserMaterialListSchema,
  laserPlugin,
  laserPostProcessor,
  parseFeedRateString,
} from './index.js';

describe('Laser PPI calculator', () => {
  it('computes accurate PPI timing, duty cycle, pulse energy, and delivered power', () => {
    const res = calculateLaserPpi({
      pulseWidthMs: 2,
      ppi: 1200,
      feedRateMmPerMin: 250,
      powerPercent: 100,
      laserWattage: 40,
      beamDiameterMm: 0.2,
    });

    expect(res.pulsesPerMm).toBeCloseTo(1200 / 25.4, 5);
    expect(res.pulsesPerSec).toBeCloseTo((1200 / 25.4) * (250 / 60), 5);
    expect(res.pulsePeriodMs).toBeCloseTo(1000 / res.pulsesPerSec, 5);
    expect(res.dutyCyclePercent).toBeCloseTo((2 / res.pulsePeriodMs) * 100, 5);
    expect(res.energyPerPulseMj).toBeCloseTo(80, 5); // 40W * 2ms = 80mJ
    expect(res.energyPerPulseJ).toBeCloseTo(0.08, 5);
    expect(res.energyDensityJPerMm).toBeCloseTo(res.pulsesPerMm * 0.08, 5);
    expect(res.energyDensityJPerCm2).toBeCloseTo((res.energyDensityJPerMm / 0.2) * 100, 5);
    expect(res.deliveredPowerW).toBeCloseTo(res.pulsesPerSec * 0.08, 5);
    expect(res.overDutyCycle).toBe(false);
  });

  it('flags over-duty-cycle when pulse width exceeds pulse period', () => {
    const res = calculateLaserPpi({
      pulseWidthMs: 10,
      ppi: 1200,
      feedRateMmPerMin: 600,
      powerPercent: 100,
      laserWattage: 40,
    });
    expect(res.dutyCyclePercent).toBeGreaterThan(100);
    expect(res.overDutyCycle).toBe(true);
  });

  it('formats M100 PPI commands cleanly', () => {
    expect(formatM100PpiCommand(1000, 85)).toBe('M100 P1000 Q85');
  });
});

describe('Laser materials & postprocessor', () => {
  it('validates all default laser material presets with Zod', () => {
    const parsed = laserMaterialListSchema.parse(DEFAULT_LASER_MATERIALS);
    expect(parsed.length).toBeGreaterThanOrEqual(7);
    expect(parseFeedRateString('F250')).toBe(250);
    expect(parseFeedRateString(180)).toBe(180);
  });

  it('generates laser G-code with M100, M3/M5 per contiguous segment group, and multipass', () => {
    const doc: IgmDocument = {
      version: 1,
      units: 'mm',
      executable: false,
      bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 20, y: 20, z: 0 }, empty: false },
      layers: [
        {
          id: 'cut',
          name: 'Cut Layer',
          visible: true,
          segments: [
            {
              type: 'line',
              kind: 'geometry',
              start: { x: 0, y: 0, z: 0 },
              end: { x: 10, y: 0, z: 0 },
              layer: 'cut',
            },
            {
              type: 'line',
              kind: 'geometry',
              start: { x: 10, y: 0, z: 0 },
              end: { x: 10, y: 10, z: 0 },
              layer: 'cut',
            },
            // Disconnected segment -> should turn M5, rapid G0, then M3
            {
              type: 'line',
              kind: 'geometry',
              start: { x: 20, y: 20, z: 0 },
              end: { x: 20, y: 0, z: 0 },
              layer: 'cut',
            },
          ],
        },
      ],
    };

    const gcode = laserIgmToGcode(doc, {
      ppiMcode: 'M100 P1000 Q100',
      feedRate: 200,
      multipass: true,
      passes: 2,
      zStepPerPassMm: 1,
    });

    expect(gcode).toContain('G90');
    expect(gcode).toContain('G21');
    expect(gcode).toContain('M100 P1000 Q100');
    expect(gcode).toContain('F200');
    expect(gcode).toContain('(Pass 1 of 2)');
    expect(gcode).toContain('(Pass 2 of 2)');
    expect(gcode).toContain('G0 Z-1');
    expect(gcode).toContain('M3\nG1 X10 Y0\nG1 X10 Y10\nM5\nG0 X20 Y20\nM3\nG1 X20 Y0');
    expect(gcode.trim().endsWith('M2')).toBe(true);

    // Plugin postprocessor interface works identically
    expect(laserPostProcessor.process(doc, { feedRate: 200 })).toContain('M100 P1000 Q100');
    expect(laserPlugin.capabilities).toEqual(['laser']);
  });
});
