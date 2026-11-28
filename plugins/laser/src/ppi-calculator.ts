export interface LaserPpiInput {
  /** Pulse duration in milliseconds (ms). */
  pulseWidthMs: number;
  /** Pulses per inch (PPI). */
  ppi: number;
  /** Feed rate in mm/min. */
  feedRateMmPerMin: number;
  /** Power setting percentage (0–100). */
  powerPercent: number;
  /** Rated laser optical power in Watts (W). */
  laserWattage: number;
  /** Optional focused spot / kerf diameter in mm (default 0.2 mm) for J/cm² calculation. */
  beamDiameterMm?: number;
}

export interface LaserPpiResult {
  /** Pulses per millimeter (pulses/mm). */
  pulsesPerMm: number;
  /** Pulse frequency in Hz (pulses/sec). */
  pulsesPerSec: number;
  /** Time between pulse starts in ms. Infinity when pulsesPerSec === 0. */
  pulsePeriodMs: number;
  /** Duty cycle percentage (%). Values > 100% indicate pulses overlap (continuous wave). */
  dutyCyclePercent: number;
  /** Energy per pulse in millijoules (mJ). */
  energyPerPulseMj: number;
  /** Energy per pulse in joules (J). */
  energyPerPulseJ: number;
  /** Linear cut energy density in J/mm. */
  energyDensityJPerMm: number;
  /** Areal cut energy density in J/cm² (using beamDiameterMm, default 0.2 mm). */
  energyDensityJPerCm2: number;
  /** Average optical power delivered to the material in Watts (W). */
  deliveredPowerW: number;
  /** True when pulseWidthMs >= pulsePeriodMs (duty cycle >= 100%). */
  overDutyCycle: boolean;
}

export const DEFAULT_LASER_PPI_INPUT: LaserPpiInput = {
  pulseWidthMs: 2,
  ppi: 1200,
  feedRateMmPerMin: 250,
  powerPercent: 100,
  laserWattage: 40,
  beamDiameterMm: 0.2,
};

/**
 * Computes Laser PPI pulse timing, duty cycle, pulse energy, energy density, and delivered power.
 */
export function calculateLaserPpi(input: LaserPpiInput): LaserPpiResult {
  const pulseWidthMs = Math.max(0, input.pulseWidthMs);
  const ppi = Math.max(0, input.ppi);
  const feedRateMmPerMin = Math.max(0, input.feedRateMmPerMin);
  const powerPercent = Math.max(0, Math.min(100, input.powerPercent));
  const laserWattage = Math.max(0, input.laserWattage);
  const beamDiameterMm =
    input.beamDiameterMm !== undefined && input.beamDiameterMm > 0
      ? input.beamDiameterMm
      : 0.2;

  const pulsesPerMm = ppi / 25.4;
  const pulsesPerSec = (pulsesPerMm * feedRateMmPerMin) / 60;
  const pulsePeriodMs = pulsesPerSec > 0 ? 1000 / pulsesPerSec : Number.POSITIVE_INFINITY;
  const dutyCyclePercent =
    Number.isFinite(pulsePeriodMs) && pulsePeriodMs > 0
      ? (pulseWidthMs / pulsePeriodMs) * 100
      : 0;

  // W * ms = mJ; W * (ms / 1000) = J
  const energyPerPulseMj = laserWattage * pulseWidthMs * (powerPercent / 100);
  const energyPerPulseJ = energyPerPulseMj / 1000;
  const energyDensityJPerMm = pulsesPerMm * energyPerPulseJ;
  // 1 cm² = 100 mm² => (J / (mm * beamDiameterMm)) * 100
  const energyDensityJPerCm2 = (energyDensityJPerMm / beamDiameterMm) * 100;
  const deliveredPowerW = pulsesPerSec * energyPerPulseJ;
  const overDutyCycle =
    Number.isFinite(pulsePeriodMs) && pulseWidthMs > 0 && pulsePeriodMs <= pulseWidthMs;

  return {
    pulsesPerMm,
    pulsesPerSec,
    pulsePeriodMs,
    dutyCyclePercent,
    energyPerPulseMj,
    energyPerPulseJ,
    energyDensityJPerMm,
    energyDensityJPerCm2,
    deliveredPowerW,
    overDutyCycle,
  };
}

/**
 * Formats a KMotionX laser PPI M-code command (e.g. `M100 P1200 Q100`).
 */
export function formatM100PpiCommand(ppi: number, powerPercent: number): string {
  const p = Math.round(Math.max(0, ppi));
  const q = Math.round(Math.max(0, Math.min(100, powerPercent)));
  return `M100 P${p} Q${q}`;
}
