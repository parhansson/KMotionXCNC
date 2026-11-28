import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { canExecute } from '@kmxcnc/cnc-core';
import { CB_MESSAGEBOX, CB_USER, CB_USER_M_CODE } from '@kmxcnc/kmx-protocol';
import type { MachineBounds } from '@kmxcnc/viewer-3d';
import { CncProvider, useCncRuntime, useCncStore } from './context/CncContext';
import { TopBar, type AppViewId } from './components/layout/TopBar';
import { PwaUpdateBanner } from './components/pwa/PwaUpdateBanner';
import { CallbackModal, type PendingCallbackItem } from './components/modals/CallbackModal';
import { ConnectionModal } from './components/modals/ConnectionModal';
import { FileDialogModal } from './components/modals/FileDialogModal';
import { CncWorkspaceView } from './views/CncWorkspaceView';
import { UI_PROFILES, type UiProfileId } from './profiles/ui-profiles';
import type { MachineConfigEditable } from './views/KflopConfigView';

// Lazy-loaded secondary views
const ImportCamView = lazy(() => import('./views/ImportCamView'));
const GeneratorsView = lazy(() => import('./views/GeneratorsView'));
const LaserToolsView = lazy(() => import('./views/LaserToolsView'));
const KflopConfigView = lazy(() => import('./views/KflopConfigView'));

const VALID_VIEWS = new Set<AppViewId>(['cnc', 'cam', 'generators', 'laser', 'kflop']);

function readHashView(): AppViewId {
  const raw = window.location.hash.replace(/^#\/?/, '').split('?')[0] as AppViewId;
  return VALID_VIEWS.has(raw) ? raw : 'cnc';
}

const ViewFallback: React.FC = () => (
  <div className="flex h-full w-full items-center justify-center gap-2 text-xs text-[var(--text-secondary)]">
    <Loader2 className="h-4 w-4 animate-spin text-[var(--accent-primary)]" />
    Loading module…
  </div>
);

const AppShell: React.FC = () => {
  const { controller, connectionSettings, applyConnection } = useCncRuntime();

  const [activeView, setActiveView] = useState<AppViewId>(readHashView);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('kmxcnc:theme');
    return saved === 'light' ? 'light' : 'dark';
  });
  const [profileId, setProfileId] = useState<UiProfileId>(() => {
    const saved = localStorage.getItem('kmxcnc:ui-profile') as UiProfileId | null;
    return saved && saved in UI_PROFILES ? saved : 'mill-3axis';
  });
  const [resetLayoutNonce, setResetLayoutNonce] = useState(0);
  const [connModalOpen, setConnModalOpen] = useState(false);
  const [fileDialog, setFileDialog] = useState<{ open: boolean; mode: 'open' | 'save-as' }>({
    open: false,
    mode: 'open',
  });

  // Subscribe to store slices
  const machineState = useCncStore((s) => s.machineState);
  const connectionState = useCncStore((s) => s.connectionState);
  const capabilities = useCncStore((s) => s.capabilities);
  const simulate = useCncStore((s) => s.simulate);
  const pendingCallback = useCncStore((s) => s.pendingCallback);
  const machineConfig = useCncStore((s) => s.machineConfig);
  const mainStatus = useCncStore((s) => s.mainStatus);
  const gcodeFilename = useCncStore((s) => s.gcode.filename);

  // Sync theme & density to <html>
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('kmxcnc:theme', theme);
  }, [theme]);

  useEffect(() => {
    const density = UI_PROFILES[profileId].density;
    document.documentElement.setAttribute('data-density', density);
    localStorage.setItem('kmxcnc:ui-profile', profileId);
  }, [profileId]);

  // Hash-based navigation (works on any static host without SPA fallback)
  useEffect(() => {
    const onHashChange = () => setActiveView(readHashView());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = (view: AppViewId) => {
    setActiveView(view);
    window.location.hash = `#/${view}`;
  };

  // Machine work envelope in mm for 3D viewer
  const machineBounds = useMemo<MachineBounds>(() => {
    const dimX = machineConfig ? machineConfig.dimX * 25.4 : 300;
    const dimY = machineConfig ? machineConfig.dimY * 25.4 : 210;
    const dimZ = machineConfig ? machineConfig.dimZ * 25.4 : 60;
    return { minX: 0, maxX: dimX, minY: 0, maxY: dimY, minZ: -dimZ, maxZ: 20 };
  }, [machineConfig]);

  // Map CncCore ControlMessage -> CallbackModal item
  const modalCallback = useMemo<PendingCallbackItem | null>(() => {
    if (!pendingCallback) return null;
    const p = pendingCallback.payload;
    if (p.type === CB_USER) {
      return { id: String(pendingCallback.id), kind: 'USER', message: p.message };
    }
    if (p.type === CB_USER_M_CODE) {
      return {
        id: String(pendingCallback.id),
        kind: 'USER_M_CODE',
        mCode: p.code,
        message: `Interpreter requested user M-code M${p.code}. Confirm to continue.`,
      };
    }
    if (p.type === CB_MESSAGEBOX) {
      return {
        id: String(pendingCallback.id),
        kind: 'MESSAGEBOX',
        title: p.title,
        message: p.message,
      };
    }
    return null;
  }, [pendingCallback]);

  // Adapt MachineConfig for KflopConfigView
  const editableMachineConfig = useMemo<MachineConfigEditable>(() => {
    const axesMap: MachineConfigEditable['axes'] = {};
    for (const ax of machineConfig?.axes ?? []) {
      axesMap[ax.name] = {
        countsPerUnit: ax.countsPerUnit ?? 2540,
        maxVel: ax.maxVel ?? 10,
        maxAccel: ax.maxAccel ?? 20,
        jogVel: ax.jogVel ?? 5,
        softLimitNeg: ax.softLimitNeg,
        softLimitPos: ax.softLimitPos,
        degrees: ax.degrees,
        radius: ax.radius,
      };
    }
    const mapAction = (a: {
      name?: string;
      action?: number;
      dParam0?: number;
      dParam1?: number;
      dParam2?: number;
      dParam3?: number;
      dParam4?: number;
      file?: string;
    }) => ({
      name: a.name ?? '',
      action: a.action ?? 0,
      dParam0: a.dParam0,
      dParam1: a.dParam1,
      dParam2: a.dParam2,
      dParam3: a.dParam3,
      dParam4: a.dParam4,
      file: a.file,
    });
    return {
      name: machineConfig?.name ?? 'KMXCNC Simulator',
      description: machineConfig?.description ?? '',
      defaultUnit: machineConfig?.defaultUnit ?? 'mm',
      dimX: machineConfig?.dimX ?? 300 / 25.4,
      dimY: machineConfig?.dimY ?? 210 / 25.4,
      dimZ: machineConfig?.dimZ ?? 60 / 25.4,
      axes: axesMap,
      tplanner: {
        breakangle: machineConfig?.tplanner.breakangle ?? 30,
        cornertolerance: machineConfig?.tplanner.cornertolerance ?? 0.003,
        lookahead: machineConfig?.tplanner.lookahead ?? 3,
        collineartolerance: machineConfig?.tplanner.collineartolerance ?? 0.0005,
        facetangle: machineConfig?.tplanner.facetangle ?? 0.5,
      },
      actions: (machineConfig?.actions ?? []).map(mapAction),
      specialActions: (machineConfig?.specialActions ?? []).map(mapAction),
      userActions: (machineConfig?.userActions ?? []).map(mapAction),
      extendedActions: (machineConfig?.extendedActions ?? []).map(mapAction),
    };
  }, [machineConfig]);

  const handleLoadGeneratedGcode = (filename: string, gcode: string) => {
    const targetPath = filename.includes('/') ? filename : `gcode/${filename}`;
    controller.setGcodeText(gcode, targetPath);
    navigate('cnc');
    if (canExecute(controller.store.getState().machineState, 'saveGcode')) {
      void controller
        .saveGcodeFile(targetPath, gcode)
        .then(() => {
          controller.store
            .getState()
            .appendLog('console', `Uploaded & selected G-code on controller: ${targetPath}`);
        })
        .catch((err) => {
          const msg = err instanceof Error ? err.message : String(err);
          controller.store
            .getState()
            .appendLog('error', `Failed to upload ${targetPath} to controller: ${msg}`);
        });
    } else {
      controller.store
        .getState()
        .appendLog('console', `Loaded generated G-code locally: ${targetPath}`);
    }
  };

  const connectionLabel =
    connectionSettings.mode === 'simulator'
      ? 'Simulator'
      : connectionSettings.mode === 'same-origin'
        ? 'Local Origin'
        : connectionSettings.baseUrl.replace(/^https?:\/\//, '');

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[var(--bg-app)] text-[var(--text-primary)]">
      <TopBar
        activeView={activeView}
        onViewChange={navigate}
        machineState={machineState}
        connectionLabel={connectionLabel}
        connected={connectionState === 'connected'}
        simulate={simulate}
        onToggleSimulate={() => void controller.toggleSimulate()}
        canToggleSimulate={canExecute(machineState, 'toggleSimulate')}
        onOpenConnection={() => setConnModalOpen(true)}
        profileId={profileId}
        onProfileChange={setProfileId}
        onResetLayout={() => setResetLayoutNonce((n) => n + 1)}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        onEmergencyStop={() => void controller.emergencyStop()}
        canEstop={canExecute(machineState, 'estop')}
      />

      <PwaUpdateBanner machineState={machineState} />

      <main className="min-h-0 flex-1 overflow-hidden">
        {activeView === 'cnc' && (
          <CncWorkspaceView
            profileId={profileId}
            theme={theme}
            resetLayoutNonce={resetLayoutNonce}
            machineBounds={machineBounds}
            onOpenFileDialog={(mode) => setFileDialog({ open: true, mode })}
          />
        )}

        {activeView === 'cam' && (
          <Suspense fallback={<ViewFallback />}>
            <ImportCamView
              theme={theme}
              machineBounds={machineBounds}
              onSendGcodeToController={handleLoadGeneratedGcode}
            />
          </Suspense>
        )}

        {activeView === 'generators' && (
          <Suspense fallback={<ViewFallback />}>
            <GeneratorsView onLoadGcode={handleLoadGeneratedGcode} />
          </Suspense>
        )}

        {activeView === 'laser' && (
          <Suspense fallback={<ViewFallback />}>
            <LaserToolsView
              canSendMdi={canExecute(machineState, 'mdi')}
              onSendMdi={(cmd) => void controller.sendMdi(cmd)}
            />
          </Suspense>
        )}

        {activeView === 'kflop' && (
          <Suspense fallback={<ViewFallback />}>
            <KflopConfigView
              theme={theme}
              mainStatus={mainStatus}
              machineConfig={editableMachineConfig}
              canSaveMachineConfig={canExecute(machineState, 'saveMachineJson')}
              onSaveMachineConfig={async (next) => {
                if (!machineConfig) return;
                const updatedAxes = machineConfig.axes.map((ax) => {
                  const edited = next.axes[ax.name];
                  return edited ? { ...ax, ...edited } : ax;
                });
                const toSavedAction = (a: MachineConfigEditable['userActions'][number]) => ({
                  name: a.name,
                  action: a.action,
                  ...(a.dParam0 !== undefined ? { dParam0: a.dParam0 } : {}),
                  ...(a.dParam1 !== undefined ? { dParam1: a.dParam1 } : {}),
                  ...(a.dParam2 !== undefined ? { dParam2: a.dParam2 } : {}),
                  ...(a.dParam3 !== undefined ? { dParam3: a.dParam3 } : {}),
                  ...(a.dParam4 !== undefined ? { dParam4: a.dParam4 } : {}),
                  ...(a.file ? { file: a.file } : {}),
                });
                await controller.saveMachineConfig({
                  ...machineConfig,
                  name: next.name,
                  defaultUnit: next.defaultUnit,
                  dimX: next.dimX,
                  dimY: next.dimY,
                  dimZ: next.dimZ,
                  axes: updatedAxes,
                  tplanner: { ...machineConfig.tplanner, ...next.tplanner },
                  actions: next.actions.map(toSavedAction),
                  specialActions: next.specialActions.map(toSavedAction),
                  userActions: next.userActions.map(toSavedAction),
                  extendedActions: next.extendedActions.map(toSavedAction),
                });
                controller.setDisplayUnit(next.defaultUnit);
              }}
              onLogMessage={(msg) => controller.store.getState().appendLog('console', msg)}
            />
          </Suspense>
        )}
      </main>

      {/* Non-blocking Interpreter Callback Modal */}
      <CallbackModal
        callback={modalCallback}
        onRespond={(id, result) => controller.acknowledgePendingCallback(result, Number(id))}
      />

      {/* Connection & Capabilities Modal */}
      <ConnectionModal
        open={connModalOpen}
        onOpenChange={setConnModalOpen}
        settings={connectionSettings}
        connectionStatus={connectionState}
        capabilities={capabilities}
        onApply={(s) => void applyConnection(s)}
      />

      {/* Open / Save As File Browser Modal */}
      <FileDialogModal
        open={fileDialog.open}
        mode={fileDialog.mode}
        initialDir="gcode"
        initialFilename={gcodeFilename.split('/').pop() || 'program.ngc'}
        onOpenChange={(open) => setFileDialog((prev) => ({ ...prev, open }))}
        listDir={async (dir) => {
          const listing = await controller.getStorage().listDir(dir);
          return listing.files.map((f) => ({ name: f.name, isDirectory: f.isDirectory }));
        }}
        onSelectOpen={(fullPath) => void controller.loadGcodeFile(fullPath)}
        onSelectSave={(fullPath) => void controller.saveGcodeFile(fullPath)}
      />
    </div>
  );
};

export const App: React.FC = () => (
  <CncProvider>
    <AppShell />
  </CncProvider>
);

export default App;
