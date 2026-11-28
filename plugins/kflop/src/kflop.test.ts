import { describe, expect, it } from 'vitest';
import {
  ALL_CONNECTORS,
  decodeAnalogIo,
  decodeBit,
  decodeDigitalIo,
  decodeThreads,
  EXTENDED_MCODES,
  getActionTypeDef,
  KFLOP_ACTION_TYPES,
  KFLOP_CONNECTORS,
  kflopPlugin,
  SPECIAL_ACTIONS,
  STANDARD_MCODES,
  USER_BUTTON_COUNT,
} from './index.js';

describe('KFLOP plugin', () => {
  it('defines JP7, JP4, JP6, JP5 connectors and extensible virtual/Kogna definitions', () => {
    expect(KFLOP_CONNECTORS.map((c) => c.id)).toEqual(['JP7', 'JP4', 'JP6', 'JP5']);
    expect(ALL_CONNECTORS.map((c) => c.id)).toContain('VIRTUAL');
    expect(ALL_CONNECTORS.map((c) => c.id)).toContain('KOGNA_200');
  });

  it('decodes digital I/O from boolean arrays and 32-bit word bitmasks', () => {
    // Bit 0: output HIGH, Bit 8: input HIGH, Bit 44: output LOW
    const bitsDirection = new Array<boolean>(48).fill(false);
    const bitsState = new Array<boolean>(48).fill(false);
    bitsDirection[0] = true;
    bitsState[0] = true;
    bitsState[8] = true;
    bitsDirection[44] = true;

    const decoded = decodeDigitalIo({ bitsDirection, bitsState });
    const jp7 = decoded.find((c) => c.id === 'JP7')!;
    const io0 = jp7.pins.find((p) => p.bitNumber === 0)!;
    const io8 = jp7.pins.find((p) => p.bitNumber === 8)!;
    const io44 = jp7.pins.find((p) => p.bitNumber === 44)!;
    const vdd = jp7.pins.find((p) => p.name === 'VDD33')!;

    expect(io0.direction).toBe('output');
    expect(io0.state).toBe(true);
    expect(io8.direction).toBe('input');
    expect(io8.state).toBe(true);
    expect(io44.direction).toBe('output');
    expect(io44.state).toBe(false);
    expect(vdd.direction).toBe('fixed');
    expect(vdd.state).toBe(true);

    // Also test uint32 word array decoding + VirtualBits + Kogna BitsState200
    const decodedMasks = decodeDigitalIo(
      {
        BitsDirection: [1 << 16, 1 << (36 - 32)], // IO16 (JP4) & IO36 (JP5) output
        BitsState: [1 << 16, 1 << (36 - 32)],
        VirtualBits: 1 << 2, // VB50 active
        BitsState200: [1 << 3], // KIO203 active
      },
      ALL_CONNECTORS,
    );
    const jp4 = decodedMasks.find((c) => c.id === 'JP4')!;
    const jp5 = decodedMasks.find((c) => c.id === 'JP5')!;
    const virtual = decodedMasks.find((c) => c.id === 'VIRTUAL')!;
    const kogna = decodedMasks.find((c) => c.id === 'KOGNA_200')!;

    expect(jp4.pins.find((p) => p.bitNumber === 16)?.state).toBe(true);
    expect(jp5.pins.find((p) => p.bitNumber === 36)?.direction).toBe('output');
    expect(virtual.pins.find((p) => p.bitNumber === 50)?.state).toBe(true);
    expect(kogna.pins.find((p) => p.bitNumber === 203)?.state).toBe(true);
  });

  it('decodes thread 1-7 status from bitmask and boolean arrays', () => {
    // Bitmask: Thread 1 & Thread 6 active; Thread 1 runOnStartUp
    const fromMask = decodeThreads({
      ThreadActive: (1 << 1) | (1 << 6),
      RunOnStartUp: 1 << 1,
    });
    expect(fromMask).toHaveLength(7);
    expect(fromMask[0]).toEqual({ thread: 1, active: true, runOnStartUp: true });
    expect(fromMask[1]).toEqual({ thread: 2, active: false, runOnStartUp: false });
    expect(fromMask[5]).toEqual({ thread: 6, active: true, runOnStartUp: false });

    // Boolean array (8 elements, indexed 1..7)
    const activeArr = [false, false, true, false, false, false, false, true];
    const fromArr = decodeThreads({ threadActive: activeArr });
    expect(fromArr[1]?.active).toBe(true);
    expect(fromArr[6]?.active).toBe(true);
    expect(fromArr[0]?.active).toBe(false);
  });

  it('decodes analog I/O channels cleanly', () => {
    const analog = decodeAnalogIo({ ADC: [100, -50], DAC: [2048], PWM: [128, 64] });
    expect(analog).toEqual({ adc: [100, -50], dac: [2048], pwm: [128, 64] });
    expect(decodeBit(0b1010, 1)).toBe(true);
    expect(decodeBit(0b1010, 2)).toBe(false);
  });

  it('exposes all 10 KFLOP action types and M-code metadata', () => {
    expect(KFLOP_ACTION_TYPES).toHaveLength(10);
    expect(getActionTypeDef(4).paramNames[0]).toBe('Thread');
    expect(getActionTypeDef(4).paramNames[5]).toBe('File');
    expect(STANDARD_MCODES).toHaveLength(11);
    expect(SPECIAL_ACTIONS).toHaveLength(8);
    expect(EXTENDED_MCODES).toHaveLength(20);
    expect(USER_BUTTON_COUNT).toBe(10);
    expect(kflopPlugin.capabilities).toEqual(['kflop']);
  });
});
