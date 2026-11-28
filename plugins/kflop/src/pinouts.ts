export type HardwareBoard = 'kflop' | 'kogna' | 'virtual';
export type ConnectorLayout = 'dual-row' | 'single-row' | 'grid';
export type PinKind = 'io' | 'power' | 'ground' | 'reset';

export interface ConnectorPinDef {
  pinNumber: number;
  name: string;
  description: string;
  bitNumber?: number;
  kind: PinKind;
  voltage?: '3.3V' | '5V' | '12V';
}

export interface ConnectorDef {
  id: string;
  name: string;
  board: HardwareBoard;
  layout: ConnectorLayout;
  pins: readonly ConnectorPinDef[];
}

export interface DecodedPinState extends ConnectorPinDef {
  direction: 'input' | 'output' | 'fixed';
  state: boolean;
}

export interface DecodedConnector {
  id: string;
  name: string;
  board: HardwareBoard;
  layout: ConnectorLayout;
  pins: DecodedPinState[];
}

export interface DecodedAnalogIo {
  adc: number[];
  dac: number[];
  pwm: number[];
}

/**
 * Structural status shape compatible with KmxMainStatus from @kmxcnc/kmx-protocol
 * (supports both boolean[] arrays and uint32[]/number bitmasks, camelCase or PascalCase).
 */
export interface MainStatusLike {
  bitsDirection?: readonly boolean[] | readonly number[] | number;
  BitsDirection?: readonly boolean[] | readonly number[] | number;
  bitsState?: readonly boolean[] | readonly number[] | number;
  BitsState?: readonly boolean[] | readonly number[] | number;
  virtualBits?: readonly boolean[] | readonly number[] | number;
  VirtualBits?: readonly boolean[] | readonly number[] | number;
  virtualBitsEx0?: number;
  VirtualBitsEx0?: number;
  bitsState200?: readonly boolean[] | readonly number[] | number;
  BitsState200?: readonly boolean[] | readonly number[] | number;
  bitsDirection200?: readonly boolean[] | readonly number[] | number;
  BitsDirection200?: readonly boolean[] | readonly number[] | number;
  threadActive?: readonly boolean[] | number;
  ThreadActive?: readonly boolean[] | number;
  runOnStartUp?: readonly boolean[] | number;
  RunOnStartUp?: readonly boolean[] | number;
  adc?: readonly number[];
  ADC?: readonly number[];
  dac?: readonly number[];
  DAC?: readonly number[];
  pwm?: readonly number[];
  PWM?: readonly number[];
}

export const KFLOP_JP7: ConnectorDef = {
  id: 'JP7',
  name: 'JP7 - GPIO',
  board: 'kflop',
  layout: 'dual-row',
  pins: [
    { pinNumber: 1, name: 'VDD33', description: '+3.3 Volts Output', kind: 'power', voltage: '3.3V' },
    { pinNumber: 2, name: 'VDD33', description: '+3.3 Volts Output', kind: 'power', voltage: '3.3V' },
    { pinNumber: 3, name: 'VDD12', description: '+12 Volts Output', kind: 'power', voltage: '12V' },
    { pinNumber: 4, name: 'RESET#', description: 'Power up Reset (low true) output', kind: 'reset', voltage: '3.3V' },
    { pinNumber: 5, name: 'IO44', description: 'Gen Purpose LVTTL I/O (3.3V Only)', bitNumber: 44, kind: 'io', voltage: '3.3V' },
    { pinNumber: 6, name: 'IO45', description: 'Gen Purpose LVTTL I/O (3.3V Only)', bitNumber: 45, kind: 'io', voltage: '3.3V' },
    { pinNumber: 7, name: 'IO0', description: 'Gen Purpose LVTTL I/O (5V Tolerant) or Encoder 0 Input Phase A', bitNumber: 0, kind: 'io', voltage: '5V' },
    { pinNumber: 8, name: 'IO1', description: 'Gen Purpose LVTTL I/O (5V Tolerant) or Encoder 0 Input Phase B', bitNumber: 1, kind: 'io', voltage: '5V' },
    { pinNumber: 9, name: 'IO2', description: 'Gen Purpose LVTTL I/O (5V Tolerant) or Encoder 1 Input Phase A', bitNumber: 2, kind: 'io', voltage: '5V' },
    { pinNumber: 10, name: 'IO3', description: 'Gen Purpose LVTTL I/O (5V Tolerant) or Encoder 1 Input Phase B', bitNumber: 3, kind: 'io', voltage: '5V' },
    { pinNumber: 11, name: 'IO4', description: 'Gen Purpose LVTTL I/O (5V Tolerant) or Encoder 2 Input Phase A', bitNumber: 4, kind: 'io', voltage: '5V' },
    { pinNumber: 12, name: 'IO5', description: 'Gen Purpose LVTTL I/O (5V Tolerant) or Encoder 2 Input Phase B', bitNumber: 5, kind: 'io', voltage: '5V' },
    { pinNumber: 13, name: 'IO6', description: 'Gen Purpose LVTTL I/O (5V Tolerant) or Encoder 3 Input Phase A', bitNumber: 6, kind: 'io', voltage: '5V' },
    { pinNumber: 14, name: 'IO7', description: 'Gen Purpose LVTTL I/O (5V Tolerant) or Encoder 3 Input Phase B', bitNumber: 7, kind: 'io', voltage: '5V' },
    { pinNumber: 15, name: 'IO8', description: 'Gen Purpose LVTTL I/O (5V Tolerant) or Axis 0 Home (or Step 0 output)', bitNumber: 8, kind: 'io', voltage: '5V' },
    { pinNumber: 16, name: 'IO9', description: 'Gen Purpose LVTTL I/O (5V Tolerant) or Axis 1 Home (or Dir 0 output)', bitNumber: 9, kind: 'io', voltage: '5V' },
    { pinNumber: 17, name: 'IO10', description: 'Gen Purpose LVTTL I/O (5V Tolerant) or Axis 2 Home (or Step 1 output)', bitNumber: 10, kind: 'io', voltage: '5V' },
    { pinNumber: 18, name: 'IO11', description: 'Gen Purpose LVTTL I/O (5V Tolerant) or Axis 3 Home (or Dir 1 output)', bitNumber: 11, kind: 'io', voltage: '5V' },
    { pinNumber: 19, name: 'IO12', description: 'Gen Purpose LVTTL I/O (5V Tolerant) or Axis 0 + Limit (or Step 2 output)', bitNumber: 12, kind: 'io', voltage: '5V' },
    { pinNumber: 20, name: 'IO13', description: 'Gen Purpose LVTTL I/O (5V Tolerant) or Axis 0 - Limit (or Dir 2 output)', bitNumber: 13, kind: 'io', voltage: '5V' },
    { pinNumber: 21, name: 'IO14', description: 'Gen Purpose LVTTL I/O (5V Tolerant) or Axis 1 + Limit (or Step 3 output)', bitNumber: 14, kind: 'io', voltage: '5V' },
    { pinNumber: 22, name: 'IO15', description: 'Gen Purpose LVTTL I/O (5V Tolerant) or Axis 1 - Limit (or Dir 3 output)', bitNumber: 15, kind: 'io', voltage: '5V' },
    { pinNumber: 23, name: 'VDD5', description: '+5 Volts Output', kind: 'power', voltage: '5V' },
    { pinNumber: 24, name: 'VDD5', description: '+5 Volts Output', kind: 'power', voltage: '5V' },
    { pinNumber: 25, name: 'GND', description: 'Digital Ground', kind: 'ground' },
    { pinNumber: 26, name: 'GND', description: 'Digital Ground', kind: 'ground' },
  ],
};

export const KFLOP_JP4: ConnectorDef = {
  id: 'JP4',
  name: 'JP4 - Aux #0',
  board: 'kflop',
  layout: 'dual-row',
  pins: [
    { pinNumber: 1, name: 'VDD5', description: '+5 Volts Output', kind: 'power', voltage: '5V' },
    { pinNumber: 2, name: 'VDD12', description: '+12 Volts Output', kind: 'power', voltage: '12V' },
    { pinNumber: 3, name: 'VDD33', description: '+3.3 Volts Output', kind: 'power', voltage: '3.3V' },
    { pinNumber: 4, name: 'RESET#', description: 'Power up Reset (low true) output', kind: 'reset', voltage: '3.3V' },
    { pinNumber: 5, name: 'IO16', description: 'Gen Purpose LVTTL I/O (3.3V Only)', bitNumber: 16, kind: 'io', voltage: '3.3V' },
    { pinNumber: 6, name: 'IO17', description: 'Gen Purpose LVTTL I/O (3.3V Only)', bitNumber: 17, kind: 'io', voltage: '3.3V' },
    { pinNumber: 7, name: 'IO18', description: 'Gen Purpose LVTTL I/O (3.3V Only)', bitNumber: 18, kind: 'io', voltage: '3.3V' },
    { pinNumber: 8, name: 'GND', description: 'Digital Ground', kind: 'ground' },
    { pinNumber: 9, name: 'GND', description: 'Digital Ground', kind: 'ground' },
    { pinNumber: 10, name: 'IO19', description: 'Gen Purpose LVTTL I/O (3.3V Only)', bitNumber: 19, kind: 'io', voltage: '3.3V' },
    { pinNumber: 11, name: 'IO20', description: 'Gen Purpose LVTTL I/O (3.3V Only)', bitNumber: 20, kind: 'io', voltage: '3.3V' },
    { pinNumber: 12, name: 'IO21', description: 'Gen Purpose LVTTL I/O (3.3V Only)', bitNumber: 21, kind: 'io', voltage: '3.3V' },
    { pinNumber: 13, name: 'IO22', description: 'Gen Purpose LVTTL I/O (3.3V Only)', bitNumber: 22, kind: 'io', voltage: '3.3V' },
    { pinNumber: 14, name: 'IO23', description: 'Gen Purpose LVTTL I/O (3.3V Only)', bitNumber: 23, kind: 'io', voltage: '3.3V' },
    { pinNumber: 15, name: 'IO24', description: 'Gen Purpose LVTTL I/O (3.3V Only)', bitNumber: 24, kind: 'io', voltage: '3.3V' },
    { pinNumber: 16, name: 'IO25', description: 'Gen Purpose LVTTL I/O (3.3V Only)', bitNumber: 25, kind: 'io', voltage: '3.3V' },
  ],
};

export const KFLOP_JP6: ConnectorDef = {
  id: 'JP6',
  name: 'JP6 - Aux #1',
  board: 'kflop',
  layout: 'dual-row',
  pins: [
    { pinNumber: 1, name: 'VDD5', description: '+5 Volts Output', kind: 'power', voltage: '5V' },
    { pinNumber: 2, name: 'VDD12', description: '+12 Volts Output', kind: 'power', voltage: '12V' },
    { pinNumber: 3, name: 'VDD33', description: '+3.3 Volts Output', kind: 'power', voltage: '3.3V' },
    { pinNumber: 4, name: 'RESET#', description: 'Power up Reset (low true) output', kind: 'reset', voltage: '3.3V' },
    { pinNumber: 5, name: 'IO26', description: 'Gen Purpose LVTTL I/O (3.3V Only) or PWM0 out', bitNumber: 26, kind: 'io', voltage: '3.3V' },
    { pinNumber: 6, name: 'IO27', description: 'Gen Purpose LVTTL I/O (3.3V Only) or PWM1 out', bitNumber: 27, kind: 'io', voltage: '3.3V' },
    { pinNumber: 7, name: 'IO28', description: 'Gen Purpose LVTTL I/O (3.3V Only) or PWM2 out', bitNumber: 28, kind: 'io', voltage: '3.3V' },
    { pinNumber: 8, name: 'GND', description: 'Digital Ground', kind: 'ground' },
    { pinNumber: 9, name: 'GND', description: 'Digital Ground', kind: 'ground' },
    { pinNumber: 10, name: 'IO29', description: 'Gen Purpose LVTTL I/O (3.3V Only) or PWM3 out', bitNumber: 29, kind: 'io', voltage: '3.3V' },
    { pinNumber: 11, name: 'IO30', description: 'Gen Purpose LVTTL I/O (3.3V Only) or PWM4 out', bitNumber: 30, kind: 'io', voltage: '3.3V' },
    { pinNumber: 12, name: 'IO31', description: 'Gen Purpose LVTTL I/O (3.3V Only) or PWM5 out', bitNumber: 31, kind: 'io', voltage: '3.3V' },
    { pinNumber: 13, name: 'IO32', description: 'Gen Purpose LVTTL I/O (3.3V Only) or PWM6 out', bitNumber: 32, kind: 'io', voltage: '3.3V' },
    { pinNumber: 14, name: 'IO33', description: 'Gen Purpose LVTTL I/O (3.3V Only) or PWM7 out', bitNumber: 33, kind: 'io', voltage: '3.3V' },
    { pinNumber: 15, name: 'IO34', description: 'Gen Purpose LVTTL I/O (3.3V Only)', bitNumber: 34, kind: 'io', voltage: '3.3V' },
    { pinNumber: 16, name: 'IO35', description: 'Gen Purpose LVTTL I/O (3.3V Only)', bitNumber: 35, kind: 'io', voltage: '3.3V' },
  ],
};

export const KFLOP_JP5: ConnectorDef = {
  id: 'JP5',
  name: 'JP5 - GPIO #1',
  board: 'kflop',
  layout: 'single-row',
  pins: [
    { pinNumber: 1, name: 'IO36', description: 'Gen Purpose LVTTL I/O (5V Tolerant) or Step 4 output / Encoder 4 Phase A', bitNumber: 36, kind: 'io', voltage: '5V' },
    { pinNumber: 2, name: 'IO37', description: 'Gen Purpose LVTTL I/O (5V Tolerant) or Dir 4 output / Encoder 4 Phase B', bitNumber: 37, kind: 'io', voltage: '5V' },
    { pinNumber: 3, name: 'IO38', description: 'Gen Purpose LVTTL I/O (5V Tolerant) or Step 5 output / Encoder 5 Phase A', bitNumber: 38, kind: 'io', voltage: '5V' },
    { pinNumber: 4, name: 'IO39', description: 'Gen Purpose LVTTL I/O (5V Tolerant) or Dir 5 output / Encoder 5 Phase B', bitNumber: 39, kind: 'io', voltage: '5V' },
    { pinNumber: 5, name: 'IO40', description: 'Gen Purpose LVTTL I/O (5V Tolerant) or Step 6 output / Encoder 6 Phase A', bitNumber: 40, kind: 'io', voltage: '5V' },
    { pinNumber: 6, name: 'IO41', description: 'Gen Purpose LVTTL I/O (5V Tolerant) or Dir 6 output / Encoder 6 Phase B', bitNumber: 41, kind: 'io', voltage: '5V' },
    { pinNumber: 7, name: 'IO42', description: 'Gen Purpose LVTTL I/O (5V Tolerant) or Step 7 output / Encoder 7 Phase A', bitNumber: 42, kind: 'io', voltage: '5V' },
    { pinNumber: 8, name: 'IO43', description: 'Gen Purpose LVTTL I/O (5V Tolerant) or Dir 7 output / Encoder 7 Phase B', bitNumber: 43, kind: 'io', voltage: '5V' },
  ],
};

export const KFLOP_VIRTUAL_BITS: ConnectorDef = {
  id: 'VIRTUAL',
  name: 'Onboard LEDs & Virtual Bits (46–63)',
  board: 'virtual',
  layout: 'grid',
  pins: [
    { pinNumber: 1, name: 'LED0 (IO46)', description: 'KFLOP Status LED 0', bitNumber: 46, kind: 'io' },
    { pinNumber: 2, name: 'LED1 (IO47)', description: 'KFLOP Status LED 1', bitNumber: 47, kind: 'io' },
    ...Array.from({ length: 16 }, (_, idx): ConnectorPinDef => ({
      pinNumber: idx + 3,
      name: `VB${48 + idx}`,
      description: `Virtual Bit ${48 + idx} (Software I/O)`,
      bitNumber: 48 + idx,
      kind: 'io',
    })),
  ],
};

export const KOGNA_EXTENDED_BITS: ConnectorDef = {
  id: 'KOGNA_200',
  name: 'Kogna Extended I/O (Bits 200–215)',
  board: 'kogna',
  layout: 'grid',
  pins: Array.from({ length: 16 }, (_, idx): ConnectorPinDef => ({
    pinNumber: idx + 1,
    name: `KIO${200 + idx}`,
    description: `Kogna Extended Digital I/O Bit ${200 + idx}`,
    bitNumber: 200 + idx,
    kind: 'io',
    voltage: '3.3V',
  })),
};

export const KFLOP_CONNECTORS: readonly ConnectorDef[] = [
  KFLOP_JP7,
  KFLOP_JP4,
  KFLOP_JP6,
  KFLOP_JP5,
];

export const ALL_CONNECTORS: readonly ConnectorDef[] = [
  KFLOP_JP7,
  KFLOP_JP4,
  KFLOP_JP6,
  KFLOP_JP5,
  KFLOP_VIRTUAL_BITS,
  KOGNA_EXTENDED_BITS,
];

/**
 * Reads a single bit from a boolean[], number[] (32-bit words), or scalar bitmask.
 */
export function decodeBit(
  source: readonly boolean[] | readonly number[] | number | undefined,
  bitIndex: number,
): boolean {
  if (source === undefined || bitIndex < 0) {
    return false;
  }
  if (typeof source === 'number') {
    if (bitIndex >= 32) return false;
    return ((source >>> bitIndex) & 1) === 1;
  }
  if (source.length === 0) {
    return false;
  }
  const first = source[0];
  if (typeof first === 'boolean') {
    return Boolean((source as readonly boolean[])[bitIndex]);
  }
  const wordIndex = Math.floor(bitIndex / 32);
  const bitOffset = bitIndex % 32;
  const word = (source as readonly number[])[wordIndex];
  if (word === undefined) {
    return false;
  }
  return ((word >>> bitOffset) & 1) === 1;
}

/**
 * Decodes digital I/O pin direction & live state from a KFLOP/Kogna MAIN_STATUS snapshot.
 */
export function decodeDigitalIo(
  mainStatus: MainStatusLike | null | undefined,
  connectors: readonly ConnectorDef[] = KFLOP_CONNECTORS,
): DecodedConnector[] {
  const dirSource = mainStatus?.bitsDirection ?? mainStatus?.BitsDirection;
  const stateSource = mainStatus?.bitsState ?? mainStatus?.BitsState;
  const virtualSource = mainStatus?.virtualBits ?? mainStatus?.VirtualBits;
  const dir200Source = mainStatus?.bitsDirection200 ?? mainStatus?.BitsDirection200;
  const state200Source = mainStatus?.bitsState200 ?? mainStatus?.BitsState200;

  return connectors.map((connector) => ({
    id: connector.id,
    name: connector.name,
    board: connector.board,
    layout: connector.layout,
    pins: connector.pins.map((pin): DecodedPinState => {
      if (pin.kind !== 'io' || pin.bitNumber === undefined) {
        return {
          ...pin,
          direction: 'fixed',
          state: pin.kind === 'power',
        };
      }

      const bit = pin.bitNumber;
      let isOutput = false;
      let state = false;

      if (bit >= 200) {
        const offset = bit - 200;
        isOutput = decodeBit(dir200Source, offset);
        state = decodeBit(state200Source, offset);
      } else if (bit >= 48 && bit < 64 && virtualSource !== undefined) {
        isOutput = true;
        state = decodeBit(virtualSource, bit - 48);
      } else {
        isOutput = decodeBit(dirSource, bit);
        state = decodeBit(stateSource, bit);
      }

      return {
        ...pin,
        direction: isOutput ? 'output' : 'input',
        state,
      };
    }),
  }));
}

/**
 * Extracts ADC, DAC, and PWM channel readings from a KFLOP/Kogna MAIN_STATUS snapshot.
 */
export function decodeAnalogIo(
  mainStatus: MainStatusLike | null | undefined,
): DecodedAnalogIo {
  const adc = mainStatus?.adc ?? mainStatus?.ADC ?? [];
  const dac = mainStatus?.dac ?? mainStatus?.DAC ?? [];
  const pwm = mainStatus?.pwm ?? mainStatus?.PWM ?? [];
  return {
    adc: Array.from(adc),
    dac: Array.from(dac),
    pwm: Array.from(pwm),
  };
}
