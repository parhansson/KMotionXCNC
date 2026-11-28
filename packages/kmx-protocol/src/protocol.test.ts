import { describe, expect, it } from 'vitest';
import {
  CB_COMPLETE,
  CB_CONSOLE,
  CB_ERR_MSG,
  CB_MESSAGEBOX,
  CB_STATUS,
  CB_USER,
  CB_USER_M_CODE,
  MockFileStorage,
  MockTransport,
  createEmptyKmxStatus,
  decodeStatusBinary,
  decodeTextMessage,
  encodeCallbackAck,
  encodeStatusBinary,
  toWebSocketUrl,
  type ControlMessage,
} from './index';

describe('kmx-protocol decoder', () => {
  it('round-trips a packed binary MAIN_STATUS + DRO frame including unaligned currentLine', () => {
    const status = createEmptyKmxStatus();
    status.mainStatus.versionAndSize = 42;
    status.mainStatus.adc[0] = 1234;
    status.mainStatus.adc[23] = -567;
    status.mainStatus.dac[3] = 2047;
    status.mainStatus.pwm[15] = 255;
    status.mainStatus.position[0] = 25400.5;
    status.mainStatus.position[7] = -128.25;
    status.mainStatus.dest[0] = 25401.0;
    status.mainStatus.outputChan0[2] = 7;
    status.mainStatus.enables = 0b00001111;
    status.mainStatus.axisDone = 0b00000101;
    status.mainStatus.bitsDirection = [0x00ff00ff, 0x0000c000];
    status.mainStatus.bitsState = [0x00010002, 0x00004000];
    status.mainStatus.runOnStartUp = 0b10;
    status.mainStatus.threadActive = 0b1010;
    status.mainStatus.stopImmediateState = 1;
    status.mainStatus.pcComm[0] = 99;
    status.mainStatus.virtualBits = 0x1234;
    status.mainStatus.virtualBitsEx0 = 0x5678;

    status.dro = { X: 1.5, Y: -2.25, Z: 0.125, A: 45, B: 0, C: 90, U: 0, V: 0 };
    status.connected = true;
    status.simulate = true;
    status.interpreting = true;
    status.currentLine = 1337;
    status.gcodeFile = 'gcode/demo.ngc';
    status.gcodeFileTimestamp = 1700000001;
    status.settingsFile = 'settings/machine.json';
    status.settingsFileTimestamp = 1700000002;
    status.timeStamp = 987.654;

    const encoded = encodeStatusBinary(status);
    const decoded = decodeStatusBinary(encoded);

    expect(decoded.mainStatus.versionAndSize).toBe(42);
    expect(decoded.mainStatus.adc[0]).toBe(1234);
    expect(decoded.mainStatus.adc[23]).toBe(-567);
    expect(decoded.mainStatus.dac[3]).toBe(2047);
    expect(decoded.mainStatus.pwm[15]).toBe(255);
    expect(decoded.mainStatus.position[0]).toBeCloseTo(25400.5);
    expect(decoded.mainStatus.position[7]).toBeCloseTo(-128.25);
    expect(decoded.mainStatus.dest[0]).toBeCloseTo(25401.0);
    expect(decoded.position.X).toBeCloseTo(25400.5);
    expect(decoded.position.V).toBeCloseTo(-128.25);
    expect(decoded.dest.X).toBeCloseTo(25401.0);
    expect(decoded.mainStatus.outputChan0[2]).toBe(7);
    expect(decoded.mainStatus.enables).toBe(0b00001111);
    expect(decoded.mainStatus.axisDone).toBe(0b00000101);
    expect(decoded.mainStatus.bitsDirection).toEqual([0x00ff00ff, 0x0000c000]);
    expect(decoded.mainStatus.bitsState).toEqual([0x00010002, 0x00004000]);
    expect(decoded.mainStatus.runOnStartUp).toBe(0b10);
    expect(decoded.mainStatus.threadActive).toBe(0b1010);
    expect(decoded.mainStatus.stopImmediateState).toBe(1);
    expect(decoded.mainStatus.pcComm[0]).toBe(99);
    expect(decoded.mainStatus.virtualBits).toBe(0x1234);
    expect(decoded.mainStatus.virtualBitsEx0).toBe(0x5678);

    expect(decoded.dro.X).toBeCloseTo(1.5);
    expect(decoded.dro.Y).toBeCloseTo(-2.25);
    expect(decoded.dro.Z).toBeCloseTo(0.125);
    expect(decoded.dro.A).toBeCloseTo(45);
    expect(decoded.dro.C).toBeCloseTo(90);
    expect(decoded.connected).toBe(true);
    expect(decoded.simulate).toBe(true);
    expect(decoded.interpreting).toBe(true);
    expect(decoded.currentLine).toBe(1337);
    expect(decoded.gcodeFile).toBe('gcode/demo.ngc');
    expect(decoded.gcodeFileTimestamp).toBe(1700000001);
    expect(decoded.settingsFile).toBe('settings/machine.json');
    expect(decoded.settingsFileTimestamp).toBe(1700000002);
    expect(decoded.timeStamp).toBeCloseTo(987.654);
  });

  it('throws on truncated binary status frames', () => {
    expect(() => decodeStatusBinary(new ArrayBuffer(100))).toThrow(RangeError);
  });

  it('decodes KMotionX handshake and all ControlMessage callback types', () => {
    expect(decodeTextMessage('KMotionX')).toEqual({ kind: 'hello', message: 'KMotionX' });

    const cases: Array<{ json: string; type: string }> = [
      {
        json: '{"id":1,"payload":{"block":false,"type":"STATUS","line":10,"message":"G1 X10"}}',
        type: CB_STATUS,
      },
      {
        json: '{"id":2,"payload":{"block":false,"type":"COMPLETE","line":12,"status":1005,"sequence":3,"message":"Halted"}}',
        type: CB_COMPLETE,
      },
      {
        json: '{"id":3,"payload":{"block":false,"type":"ERR_MSG","message":"Soft limit"}}',
        type: CB_ERR_MSG,
      },
      {
        json: '{"id":4,"payload":{"block":false,"type":"CONSOLE","message":"Init OK"}}',
        type: CB_CONSOLE,
      },
      {
        json: '{"id":5,"payload":{"block":true,"type":"USER","message":"Change tool?"}}',
        type: CB_USER,
      },
      {
        json: '{"id":6,"payload":{"block":true,"type":"USER_M_CODE","code":100}}',
        type: CB_USER_M_CODE,
      },
      {
        json: '{"id":7,"payload":{"block":true,"type":"MESSAGEBOX","options":1,"title":"Prompt","message":"Continue?"}}',
        type: CB_MESSAGEBOX,
      },
    ];

    for (const c of cases) {
      const decoded = decodeTextMessage(c.json);
      expect(decoded.kind).toBe('control');
      if (decoded.kind === 'control') {
        expect(decoded.message.payload.type).toBe(c.type);
      }
    }

    expect(decodeTextMessage('not-json')).toEqual({ kind: 'unknown', raw: 'not-json' });
  });

  it('encodes CB_ACK with exact key order expected by WebController sscanf', () => {
    expect(encodeCallbackAck(42, 0)).toBe('{"type":"CB_ACK","id":42,"returnValue":0}');
    expect(encodeCallbackAck(7, 1)).toBe('{"type":"CB_ACK","id":7,"returnValue":1}');
  });

  it('converts HTTP/HTTPS base URLs to WS/WSS URLs', () => {
    expect(toWebSocketUrl('https://cnc.local:8443/')).toBe('wss://cnc.local:8443/ws');
    expect(toWebSocketUrl('http://192.168.1.50:8080')).toBe('ws://192.168.1.50:8080/ws');
  });
});

describe('MockTransport & MockFileStorage', () => {
  it('lists, reads, and writes in-memory machine files', async () => {
    const storage = new MockFileStorage();
    const gcodeDir = await storage.listDir('gcode');
    expect(gcodeDir.files.some((f) => f.name === 'demo.ngc' && !f.isDirectory)).toBe(true);

    await storage.writeFile('gcode/test.ngc', 'G21 G90\nG0 X25.4 Y50.8\nM30\n');
    expect(await storage.readFile('gcode/test.ngc')).toContain('X25.4');
  });

  it('simulates G-code execution, Feed Hold, Halt (status 1005), MDI, Jog, and E-Stop', async () => {
    const storage = new MockFileStorage({
      'gcode/move.ngc': 'G21 G90\nG1 X25.4 Y50.8 F6000\nM30\n',
    });
    const transport = new MockTransport({
      storage,
      tickIntervalMs: 0, // deterministic manual ticks
      initialGcodeFile: 'gcode/move.ngc',
    });

    const messages: ControlMessage[] = [];
    transport.onMessage((m) => messages.push(m));

    await transport.connect();
    expect(transport.getConnectionState()).toBe('connected');

    const caps = await transport.getCapabilities();
    expect(caps.maxAxes).toBe(8);
    expect(caps.features.deadmanJog).toBe(true);

    // Step through line 0 (G21 G90) and line 1 (G1 X25.4 Y50.8)
    await transport.invoke('onStep');
    await transport.invoke('onStep');
    let status = transport.buildStatus();
    expect(status.dro.X).toBeCloseTo(1.0, 4); // 25.4mm = 1 inch
    expect(status.dro.Y).toBeCloseTo(2.0, 4); // 50.8mm = 2 inches

    // MDI move in Z
    await transport.sendMdi('G0 Z-12.7');
    status = transport.buildStatus();
    expect(status.dro.Z).toBeCloseTo(-0.5, 4);

    // Continuous jog on X
    await transport.jog(0, 2540); // +1 inch/sec
    transport.tick(0.5);
    expect(transport.buildStatus().dro.X).toBeCloseTo(1.5, 4);
    await transport.jog(0, 0);

    // Feed Hold toggles stopImmediateState
    await transport.invoke('onFeedhold');
    expect(transport.buildStatus().mainStatus.stopImmediateState).toBe(1);
    await transport.invoke('onFeedhold');
    expect(transport.buildStatus().mainStatus.stopImmediateState).toBe(0);

    // Halt emits COMPLETE with status 1005
    await transport.invoke('onCycleStart');
    await transport.invoke('onHalt');
    expect(
      messages.some((m) => m.payload.type === CB_COMPLETE && m.payload.status === 1005),
    ).toBe(true);

    // E-Stop disables axes and clears threads 2..7
    await transport.invoke('onEmergencyStop');
    status = transport.buildStatus();
    expect(status.mainStatus.enables).toBe(0);
    expect(messages.some((m) => m.payload.type === CB_ERR_MSG)).toBe(true);

    await transport.disconnect();
    expect(transport.getConnectionState()).toBe('disconnected');
  });

  it('rejects motion RPCs when offline mode is enabled', async () => {
    const transport = new MockTransport({ tickIntervalMs: 0, offline: true });
    await transport.connect();
    await expect(transport.invoke('onCycleStart')).rejects.toThrow(/403/);
    await expect(transport.setGcodeFile('gcode/demo.ngc')).resolves.toMatchObject({ ret: 0 });
    await transport.disconnect();
  });
});
