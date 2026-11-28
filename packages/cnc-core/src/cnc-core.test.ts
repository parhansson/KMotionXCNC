import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CB_USER,
  MockFileStorage,
  MockTransport,
  createEmptyKmxStatus,
} from '@kmxcnc/kmx-protocol';
import {
  CncController,
  canExecute,
  controllerAxesToMm,
  createKeyboardAdapter,
  deriveMachineState,
  formatAxisValue,
  formatCoord,
  fromDisplayUnit,
  inchesToMm,
  mmToInches,
  parseMachineConfig,
  parseUiLayout,
  type MachineState,
} from './index';

describe('units (canonical mm <-> in via decimal.js-light)', () => {
  it('converts mm <-> inches without floating point drift', () => {
    expect(inchesToMm(1)).toBe(25.4);
    expect(mmToInches(25.4)).toBe(1);
    expect(inchesToMm(mmToInches(100))).toBe(100);
    expect(mmToInches(254)).toBe(10);
    expect(fromDisplayUnit('2.5', 'in')).toBe(63.5);
  });

  it('converts linear axes to mm while keeping rotary A/B/C in degrees', () => {
    const mm = controllerAxesToMm({
      X: 1,
      Y: 2,
      Z: -0.5,
      A: 90,
      B: 45,
      C: 180,
      U: 1,
      V: 0,
    });
    expect(mm.X).toBe(25.4);
    expect(mm.Y).toBe(50.8);
    expect(mm.Z).toBe(-12.7);
    expect(mm.A).toBe(90);
    expect(mm.B).toBe(45);
    expect(mm.C).toBe(180);
    expect(mm.U).toBe(25.4);
  });

  it('formats coordinates cleanly for mm, in, and deg', () => {
    expect(formatCoord(25.4, 'mm')).toBe('25.400');
    expect(formatCoord(25.4, 'in')).toBe('1.0000');
    expect(formatAxisValue('A', 45.5, 'in')).toBe('45.500');
    expect(formatAxisValue('X', 25.4, 'in')).toBe('1.0000');
  });
});

describe('CNC FSM safety rules', () => {
  const connectedStates: MachineState[] = [
    'idle',
    'running',
    'halted',
    'feedhold',
    'estop',
    'simulating',
  ];

  it('always allows estop and feedHold when connected', () => {
    for (const state of connectedStates) {
      expect(canExecute(state, 'estop')).toBe(true);
      expect(canExecute(state, 'feedHold')).toBe(true);
    }
  });

  it('blocks jog, zeroing, MDI, and saving machine.json while running or simulating', () => {
    for (const state of ['running', 'simulating'] as const) {
      expect(canExecute(state, 'jog')).toBe(false);
      expect(canExecute(state, 'stepJog')).toBe(false);
      expect(canExecute(state, 'zeroAxis')).toBe(false);
      expect(canExecute(state, 'zeroAll')).toBe(false);
      expect(canExecute(state, 'mdi')).toBe(false);
      expect(canExecute(state, 'saveMachineJson')).toBe(false);
      expect(canExecute(state, 'halt')).toBe(true);
    }
  });

  it('locks all motion commands when disconnected or offline', () => {
    for (const state of ['disconnected', 'offline'] as const) {
      expect(canExecute(state, 'cycleStart')).toBe(false);
      expect(canExecute(state, 'jog')).toBe(false);
      expect(canExecute(state, 'mdi')).toBe(false);
      expect(canExecute(state, 'estop')).toBe(false);
    }
    // Offline preview mode still permits editing/saving machine.json & G-code
    expect(canExecute('offline', 'saveMachineJson')).toBe(true);
    expect(canExecute('offline', 'saveGcode')).toBe(true);
    expect(canExecute('disconnected', 'saveMachineJson')).toBe(false);
  });

  it('derives machine state accurately from transport status', () => {
    const status = createEmptyKmxStatus();
    status.connected = true;
    expect(
      deriveMachineState({ connectionState: 'disconnected', status, previousState: 'idle' }),
    ).toBe('disconnected');

    expect(
      deriveMachineState({ connectionState: 'connected', status, previousState: 'disconnected' }),
    ).toBe('idle');

    status.interpreting = true;
    expect(
      deriveMachineState({ connectionState: 'connected', status, previousState: 'idle' }),
    ).toBe('running');

    status.simulate = true;
    expect(
      deriveMachineState({ connectionState: 'connected', status, previousState: 'running' }),
    ).toBe('simulating');

    status.mainStatus.stopImmediateState = 1;
    expect(
      deriveMachineState({ connectionState: 'connected', status, previousState: 'simulating' }),
    ).toBe('feedhold');

    expect(
      deriveMachineState({
        connectionState: 'connected',
        status,
        previousState: 'feedhold',
        estopLatched: true,
      }),
    ).toBe('estop');
  });
});

describe('Zod schemas (machine.json & ui-layout.json)', () => {
  it('parses real machines/laser/settings/machine.json and machines/minirouter/settings/machine.json', () => {
    const repoRoot = path.resolve(__dirname, '../../..');
    const laserRaw = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'machines/laser/settings/machine.json'), 'utf8'),
    );
    const laser = parseMachineConfig(laserRaw);
    expect(laser.name).toBe('laser');
    expect(laser.dimX).toBeCloseTo(11.811023622, 6);
    expect(laser.axes).toHaveLength(6);
    expect(laser.axes[0]?.countsPerUnit).toBe(2540);
    expect(laser.userActions[2]?.action).toBe(4); // coerced from string "4"

    const routerRaw = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'machines/minirouter/settings/machine.json'), 'utf8'),
    );
    const router = parseMachineConfig(routerRaw);
    expect(router.name).toBe('Minirouter');
    expect(router.extendedActions[0]?.action).toBe(0); // coerced from string "0"
  });

  it('supports extended 8-axis MOTION_PARAMS and UI layout config', () => {
    const extended = parseMachineConfig({
      name: '8-Axis Mill',
      dimX: 20,
      dimY: 15,
      dimZ: 8,
      defaultUnit: 'mm',
      uiProfile: '8axis',
      enabledPlugins: ['kflop', 'generators'],
      ThirdOrderTP: true,
      axes: [
        { name: 'X', countsPerUnit: 2540, softLimitNeg: 0, softLimitPos: 20, maxJerk: 500 },
        { name: 'Y', countsPerUnit: 2540 },
        { name: 'Z', countsPerUnit: 4064 },
        { name: 'A', degrees: true, radius: 2.5 },
        { name: 'B', degrees: true },
        { name: 'C', degrees: true },
        { name: 'U', countsPerUnit: 1000 },
        { name: 'V', countsPerUnit: 1000 },
      ],
      tplanner: {
        breakangle: 5,
        cornertolerance: 0.003,
        lookahead: 3,
        collineartolerance: 0.0005,
        facetangle: 0.5,
        thirdOrderTP: true,
      },
    });
    expect(extended.axes).toHaveLength(8);
    expect(extended.axes[3]?.degrees).toBe(true);
    expect(extended.axes[3]?.radius).toBe(2.5);
    expect(extended.uiProfile).toBe('8axis');

    const layout = parseUiLayout({
      profileId: 'touch-big-jog',
      theme: 'dark',
      density: 'touch',
      visibleAxes: ['X', 'Y', 'Z', 'A'],
    });
    expect(layout.profileId).toBe('touch-big-jog');
    expect(layout.density).toBe('touch');
  });
});

describe('CncController deadman jog, callbacks, DRO & keyboard adapter', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('refreshes deadman jog every 150ms and guarantees jog(axis, 0) on stop and disconnect', async () => {
    vi.useFakeTimers();
    const storage = new MockFileStorage();
    const transport = new MockTransport({ storage, tickIntervalMs: 0 });
    const jogSpy = vi.spyOn(transport, 'jog');
    const controller = new CncController({ transport, storage, jogHeartbeatMs: 150 });

    await controller.connect();
    await controller.startJog('X', 3000);
    expect(jogSpy).toHaveBeenCalledWith(0, 3000);

    // Advance 460ms -> initial call + 3 heartbeats
    await vi.advanceTimersByTimeAsync(460);
    expect(jogSpy.mock.calls.filter(([a, s]) => a === 0 && s === 3000).length).toBeGreaterThanOrEqual(4);

    // Release guarantees jog(0, 0) and stops further heartbeats
    await controller.stopJog('X');
    expect(jogSpy).toHaveBeenLastCalledWith(0, 0);
    const countAfterStop = jogSpy.mock.calls.length;
    await vi.advanceTimersByTimeAsync(500);
    expect(jogSpy.mock.calls.length).toBe(countAfterStop);

    // Starting jog then disconnecting also guarantees jog(axis, 0)
    await controller.startJog('Y', -2000);
    await controller.disconnect();
    expect(jogSpy).toHaveBeenLastCalledWith(1, 0);
    expect(controller.store.getState().machineState).toBe('disconnected');

    controller.dispose();
  });

  it('queues blocking interpreter callbacks and sends CB_ACK on acknowledge', async () => {
    const storage = new MockFileStorage();
    const transport = new MockTransport({ storage, tickIntervalMs: 0 });
    const controller = new CncController({ transport, storage });
    await controller.connect();

    const id = transport.triggerCallback({
      type: CB_USER,
      block: true,
      message: 'Insert 6mm endmill?',
    });
    expect(controller.store.getState().pendingCallback?.id).toBe(id);

    controller.acknowledgePendingCallback(0);
    expect(controller.store.getState().pendingCallback).toBeNull();
    expect(transport.getLastAck()).toEqual({ id, returnValue: 0 });

    controller.dispose();
  });

  it('handles work offsets (zeroAxis / setFixture) and keyboard adapter', async () => {
    const storage = new MockFileStorage();
    const transport = new MockTransport({ storage, tickIntervalMs: 0 });
    const controller = new CncController({ transport, storage });
    await controller.connect();

    // Move machine to X=25.4mm via MDI
    await controller.sendMdi('G21 G90 G0 X25.4 Y10');
    expect(controller.store.getState().dro.machinePos.X).toBeCloseTo(25.4, 3);

    // Zero X in G54
    await controller.zeroAxis('X');
    expect(controller.store.getState().dro.workPos.X).toBeCloseTo(0, 3);

    // Switch to G55 -> workPos reflects G55 offset (0) so workPos.X = 25.4
    await controller.setFixture('G55');
    expect(controller.store.getState().dro.fixture).toBe('G55');
    expect(controller.store.getState().dro.workPos.X).toBeCloseTo(25.4, 3);

    // Keyboard adapter triggers jog on ArrowRight and stops on keyup
    const listeners = new Map<string, Set<EventListener>>();
    const mockTarget = {
      addEventListener(type: string, fn: EventListener) {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type)!.add(fn);
      },
      removeEventListener(type: string, fn: EventListener) {
        listeners.get(type)?.delete(fn);
      },
    };

    const jogSpy = vi.spyOn(transport, 'jog');
    const detach = createKeyboardAdapter(controller, {
      target: mockTarget as unknown as Window,
      slowSpeed: 1500,
      fastSpeed: 4500,
    });

    const emit = (type: string, event: Record<string, unknown>) => {
      for (const fn of listeners.get(type) ?? []) {
        fn(event as unknown as Event);
      }
    };

    emit('keydown', { key: 'ArrowRight', code: 'ArrowRight', shiftKey: true, repeat: false, target: null, preventDefault: () => {} });
    await Promise.resolve();
    expect(jogSpy).toHaveBeenCalledWith(0, 4500);

    emit('keyup', { key: 'ArrowRight', code: 'ArrowRight', target: null });
    await Promise.resolve();
    expect(jogSpy).toHaveBeenLastCalledWith(0, 0);

    detach();
    controller.dispose();
  });
});
