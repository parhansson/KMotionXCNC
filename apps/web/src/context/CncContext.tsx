import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  HttpFileStorage,
  HttpWsTransport,
  MockFileStorage,
  MockTransport,
} from '@kmxcnc/kmx-protocol';
import {
  CncController,
  createCncStore,
  createKeyboardAdapter,
  type CncStoreState,
} from '@kmxcnc/cnc-core';
import { analyzePreflight, type IgmDocument, type PreflightResult } from '@kmxcnc/igm';
import { parseGcodeToIgm } from '@kmxcnc/cam-engine';
import { PluginRegistry } from '@kmxcnc/plugin-sdk';
import { kflopPlugin } from '@kmxcnc/plugin-kflop';
import { laserPlugin } from '@kmxcnc/plugin-laser';
import { generatorsPlugin } from '@kmxcnc/plugin-generators';
import type { ConnectionSettings } from '../components/modals/ConnectionModal';

const CONN_STORAGE_KEY = 'kmxcnc:connection-settings:v1';

function loadSavedConnectionSettings(): ConnectionSettings | null {
  try {
    const raw = localStorage.getItem(CONN_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ConnectionSettings>;
      if (
        parsed.mode === 'simulator' ||
        parsed.mode === 'same-origin' ||
        parsed.mode === 'custom-lan'
      ) {
        return {
          mode: parsed.mode,
          baseUrl: parsed.baseUrl ?? '',
          authToken: parsed.authToken ?? '',
        };
      }
    }
  } catch {
    // ignore
  }
  return null;
}

async function detectSameOriginBackend(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.location.protocol.startsWith('http')) {
    return false;
  }
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 1500);
  try {
    const res = await fetch('/api/kmx/capabilities', {
      method: 'GET',
      cache: 'no-store',
      signal: ac.signal,
    });
    if (!res.ok) return false;
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('json')) return false;
    const data = (await res.json()) as Record<string, unknown>;
    return typeof data.apiVersion === 'number' || typeof data.maxAxes === 'number';
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export interface CncRuntimeContextValue {
  controller: CncController;
  pluginRegistry: PluginRegistry;
  connectionSettings: ConnectionSettings;
  applyConnection: (settings: ConnectionSettings) => Promise<void>;
  keyboardEnabled: boolean;
  setKeyboardEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  igm: IgmDocument | null;
  preflight: PreflightResult | null;
}

const CncRuntimeContext = createContext<CncRuntimeContextValue | null>(null);

export const CncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [connectionSettings, setConnectionSettings] = useState<ConnectionSettings>(
    () => loadSavedConnectionSettings() ?? { mode: 'simulator', baseUrl: '', authToken: '' },
  );
  const [keyboardEnabled, setKeyboardEnabled] = useState(false);

  const pluginRegistry = useMemo(() => {
    const reg = new PluginRegistry();
    reg.register(kflopPlugin);
    reg.register(laserPlugin);
    reg.register(generatorsPlugin);
    return reg;
  }, []);

  const controllerRef = useRef<CncController | null>(null);
  if (!controllerRef.current) {
    const storage = new MockFileStorage();
    const transport = new MockTransport({ storage, tickIntervalMs: 100 });
    const store = createCncStore({ mode: 'mock', baseUrl: '' });
    controllerRef.current = new CncController({ transport, storage, store });
  }
  const controller = controllerRef.current;

  const applyConnection = async (settings: ConnectionSettings, persist = true) => {
    setConnectionSettings(settings);
    if (persist) {
      try {
        localStorage.setItem(CONN_STORAGE_KEY, JSON.stringify(settings));
      } catch {
        // ignore
      }
    }

    if (settings.mode === 'simulator') {
      const storage = new MockFileStorage();
      const transport = new MockTransport({ storage, tickIntervalMs: 100 });
      controller.store.getState().setConnectionConfig({ mode: 'mock', baseUrl: '' });
      await controller.setTransport(transport, storage);
      await controller.connect();
      return;
    }

    const baseUrl = settings.mode === 'custom-lan' ? settings.baseUrl : '';
    const authToken = settings.authToken || undefined;
    const storage = new HttpFileStorage({ baseUrl, authToken });
    const transport = new HttpWsTransport({ baseUrl, authToken, useWorker: false });
    controller.store.getState().setConnectionConfig({
      mode: settings.mode === 'custom-lan' ? 'lan' : 'local',
      baseUrl,
      authToken,
    });
    await controller.setTransport(transport, storage);
    await controller.connect();
  };

  // Connect on initial mount: respect saved setting, or auto-detect same-origin kmxWeb before falling back to Simulator
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      const saved = loadSavedConnectionSettings();
      let initial: ConnectionSettings;
      if (saved) {
        initial = saved;
      } else {
        const hasSameOrigin = await detectSameOriginBackend();
        if (cancelled) return;
        initial = hasSameOrigin
          ? { mode: 'same-origin', baseUrl: '', authToken: '' }
          : { mode: 'simulator', baseUrl: '', authToken: '' };
      }

      try {
        await applyConnection(initial, false);
      } catch {
        if (!cancelled && initial.mode !== 'simulator') {
          await applyConnection({ mode: 'simulator', baseUrl: '', authToken: '' }, false);
        }
      }
    };
    void init();
    return () => {
      cancelled = true;
      controller.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard jogging adapter
  const keyboardEnabledRef = useRef(keyboardEnabled);
  keyboardEnabledRef.current = keyboardEnabled;

  useEffect(() => {
    return createKeyboardAdapter(controller, {
      isEnabled: () => keyboardEnabledRef.current,
    });
  }, [controller]);

  // Reactive G-code -> IGM -> Preflight pipeline
  const gcodeText = useSyncExternalStore(
    controller.store.subscribe,
    () => controller.store.getState().gcode.text,
  );
  const blockDelete = useSyncExternalStore(
    controller.store.subscribe,
    () => controller.store.getState().blockDelete,
  );
  const machineConfig = useSyncExternalStore(
    controller.store.subscribe,
    () => controller.store.getState().machineConfig,
  );

  const { igm, preflight } = useMemo(() => {
    if (!gcodeText.trim()) {
      return { igm: null, preflight: null };
    }
    const parsed = parseGcodeToIgm(gcodeText, { blockDelete });
    const dimX = machineConfig ? machineConfig.dimX * 25.4 : 300;
    const dimY = machineConfig ? machineConfig.dimY * 25.4 : 210;
    const dimZ = machineConfig ? machineConfig.dimZ * 25.4 : 60;

    const softLimitNeg: Partial<Record<'x' | 'y' | 'z' | 'a' | 'b' | 'c' | 'u' | 'v', number>> = {};
    const softLimitPos: Partial<Record<'x' | 'y' | 'z' | 'a' | 'b' | 'c' | 'u' | 'v', number>> = {};

    if (machineConfig) {
      for (const ax of machineConfig.axes) {
        const key = ax.name.toLowerCase() as 'x' | 'y' | 'z' | 'a' | 'b' | 'c' | 'u' | 'v';
        const isRotary = ax.degrees === true || ['A', 'B', 'C'].includes(ax.name);
        const factor = isRotary ? 1 : 25.4;
        if (ax.softLimitNeg !== undefined && Math.abs(ax.softLimitNeg) < 1e6) {
          softLimitNeg[key] = ax.softLimitNeg * factor;
        }
        if (ax.softLimitPos !== undefined && Math.abs(ax.softLimitPos) < 1e6) {
          softLimitPos[key] = ax.softLimitPos * factor;
        }
      }
    }

    const pf = analyzePreflight(parsed, { dimX, dimY, dimZ, softLimitNeg, softLimitPos });
    return { igm: parsed, preflight: pf };
  }, [gcodeText, blockDelete, machineConfig]);

  const value = useMemo<CncRuntimeContextValue>(
    () => ({
      controller,
      pluginRegistry,
      connectionSettings,
      applyConnection,
      keyboardEnabled,
      setKeyboardEnabled,
      igm,
      preflight,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [controller, pluginRegistry, connectionSettings, keyboardEnabled, igm, preflight],
  );

  return <CncRuntimeContext.Provider value={value}>{children}</CncRuntimeContext.Provider>;
};

export function useCncRuntime(): CncRuntimeContextValue {
  const ctx = useContext(CncRuntimeContext);
  if (!ctx) throw new Error('useCncRuntime must be used inside CncProvider');
  return ctx;
}

export function useCncStore<T>(selector: (state: CncStoreState) => T): T {
  const { controller } = useCncRuntime();
  return useSyncExternalStore(controller.store.subscribe, () =>
    selector(controller.store.getState()),
  );
}
