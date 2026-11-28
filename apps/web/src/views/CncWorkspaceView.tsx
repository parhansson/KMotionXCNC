import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DockviewReact,
  type DockviewApi,
  type DockviewReadyEvent,
  type IDockviewPanelProps,
} from 'dockview';
import type { SourceRef } from '@kmxcnc/igm';
import type { MachineBounds } from '@kmxcnc/viewer-3d';
import { canExecute, type FixtureName } from '@kmxcnc/cnc-core';
import { useCncRuntime, useCncStore } from '../context/CncContext';
import {
  applyDefaultDockviewLayout,
  clearSavedLayout,
  loadSavedLayout,
  saveLayout,
  UI_PROFILES,
  type AxisKey,
  type UiProfileId,
} from '../profiles/ui-profiles';
import { DroPanel } from '../components/cnc/DroPanel';
import { ControlsPanel } from '../components/cnc/ControlsPanel';
import { JogPanel } from '../components/cnc/JogPanel';
import { Viewer3DPanel } from '../components/cnc/Viewer3DPanel';
import { GcodeEditorPanel } from '../components/cnc/GcodeEditorPanel';
import { LogsPanel } from '../components/cnc/LogsPanel';

export interface CncWorkspaceViewProps {
  profileId: UiProfileId;
  theme: 'dark' | 'light';
  resetLayoutNonce: number;
  machineBounds: MachineBounds;
  onOpenFileDialog: (mode: 'open' | 'save-as') => void;
}

// Individual Dockview panel wrappers that subscribe granularly to the CNC store
const DroDockPanel: React.FC<{ profileId: UiProfileId; touchMode?: boolean }> = ({
  profileId,
  touchMode,
}) => {
  const { controller } = useCncRuntime();
  const profile = UI_PROFILES[profileId];
  const dro = useCncStore((s) => s.dro);
  const enables = useCncStore((s) => s.enables);
  const axisDone = useCncStore((s) => s.axisDone);
  const displayUnit = useCncStore((s) => s.displayUnit);
  const machineState = useCncStore((s) => s.machineState);

  const canZero = canExecute(machineState, 'zeroAxis');

  return (
    <DroPanel
      axes={profile.axes}
      machinePos={dro.machinePos}
      workPos={dro.workPos}
      followingError={dro.followingError}
      enablesMask={enables}
      axisDoneMask={axisDone}
      coordMode={dro.coordMode}
      onCoordModeChange={(m) => controller.setCoordMode(m)}
      fixture={dro.fixture}
      onFixtureChange={(f) => void controller.setFixture(f as FixtureName)}
      displayUnit={displayUnit}
      onToggleUnit={() => controller.setDisplayUnit(displayUnit === 'mm' ? 'in' : 'mm')}
      diameterMode={dro.diameterMode}
      onToggleDiameterMode={() => controller.setDiameterMode(!dro.diameterMode)}
      canZero={canZero}
      onZeroAxis={(axis) => void controller.zeroAxis(axis)}
      onZeroAll={() => void controller.zeroAll()}
      touchMode={touchMode}
    />
  );
};

const ControlsDockPanel: React.FC<{ profileId: UiProfileId }> = ({ profileId }) => {
  const { controller, preflight } = useCncRuntime();
  const profile = UI_PROFILES[profileId];
  const machineState = useCncStore((s) => s.machineState);
  const blockDelete = useCncStore((s) => s.blockDelete);
  const overrides = useCncStore((s) => s.overrides);
  const machineConfig = useCncStore((s) => s.machineConfig);

  const userButtons = useMemo(() => {
    const actions = machineConfig?.userActions ?? [];
    return actions
      .map((a, idx) => ({ index: idx, action: a.action, name: a.name?.trim() || '[Unnamed]' }))
      .filter((a) => a.action > 0);
  }, [machineConfig]);

  return (
    <ControlsPanel
      machineState={machineState}
      canCycleStart={canExecute(machineState, 'cycleStart')}
      canHalt={canExecute(machineState, 'halt')}
      canFeedHold={canExecute(machineState, 'feedHold')}
      canStep={canExecute(machineState, 'step')}
      canReset={canExecute(machineState, 'reset')}
      canMdi={canExecute(machineState, 'mdi')}
      blockDelete={blockDelete}
      onToggleBlockDelete={() => void controller.setBlockDelete(!blockDelete)}
      onCycleStart={() => void controller.cycleStart()}
      onHalt={() => void controller.halt()}
      onFeedHold={() => {
        if (machineState === 'feedhold') void controller.resume();
        else void controller.feedHold();
      }}
      onStep={() => void controller.step()}
      onReset={() => void controller.reset()}
      onSendMdi={(line) => void controller.sendMdi(line)}
      fro={overrides.fro}
      sso={overrides.sso}
      onFroChange={(fro) => controller.setFeedRateOverride(fro)}
      onSsoChange={(sso) => controller.setSpindleRateOverride(sso)}
      showSpindleOverride={profile.showSpindleOverrides}
      preflight={preflight}
      userButtons={userButtons}
      onInvokeUserButton={(idx) => void controller.invokeUserButton(idx)}
    />
  );
};

const JogDockPanel: React.FC<{ profileId: UiProfileId; touchMode?: boolean }> = ({
  profileId,
  touchMode,
}) => {
  const { controller, keyboardEnabled, setKeyboardEnabled } = useCncRuntime();
  const profile = UI_PROFILES[profileId];
  const machineState = useCncStore((s) => s.machineState);
  const canJog = canExecute(machineState, 'jog');

  const handleStartJog = (axis: AxisKey, dir: 1 | -1, fast: boolean) => {
    const speed = (fast ? 6000 : 2000) * dir;
    void controller.startJog(axis, speed);
  };

  return (
    <JogPanel
      axes={profile.axes}
      canJog={canJog}
      keyboardEnabled={keyboardEnabled}
      onToggleKeyboard={() => setKeyboardEnabled((k) => !k)}
      onStartContinuousJog={handleStartJog}
      onStopContinuousJog={(axis) => void controller.stopJog(axis)}
      onStepJog={(axis, deltaMm) => void controller.stepJog(axis, deltaMm)}
      touchMode={touchMode}
    />
  );
};

const ViewerDockPanel: React.FC<{
  profileId: UiProfileId;
  theme: 'dark' | 'light';
  machineBounds: MachineBounds;
}> = ({ profileId, theme, machineBounds }) => {
  const { controller, igm } = useCncRuntime();
  const profile = UI_PROFILES[profileId];
  const [rotary, setRotary] = useState(profile.defaultRotary4thAxis);
  const workPos = useCncStore((s) => s.dro.workPos);
  const currentLine = useCncStore((s) => s.gcode.currentLine);
  const selectedLine = useCncStore((s) => s.gcode.selectedLine);

  useEffect(() => {
    setRotary(profile.defaultRotary4thAxis);
  }, [profile.defaultRotary4thAxis]);

  const highlight: SourceRef | null = useMemo(() => {
    const line = selectedLine ?? (currentLine > 0 ? currentLine : null);
    return line ? { kind: 'gcode', line } : null;
  }, [selectedLine, currentLine]);

  const toolPosition = useMemo(
    () => ({ x: workPos.X, y: workPos.Y, z: workPos.Z }),
    [workPos.X, workPos.Y, workPos.Z],
  );

  return (
    <Viewer3DPanel
      igm={igm}
      machineBounds={machineBounds}
      toolPosition={toolPosition}
      highlight={highlight}
      theme={theme}
      rotary4thAxis={rotary}
      onToggleRotary={() => setRotary((r) => !r)}
      onSelectSource={(src) => {
        if (src?.kind === 'gcode') {
          controller.store.getState().setGcode({ selectedLine: src.line });
        } else {
          controller.store.getState().setGcode({ selectedLine: null });
        }
      }}
    />
  );
};

const GcodeDockPanel: React.FC<{
  theme: 'dark' | 'light';
  onOpenFileDialog: (mode: 'open' | 'save-as') => void;
}> = ({ theme, onOpenFileDialog }) => {
  const { controller } = useCncRuntime();
  const gcode = useCncStore((s) => s.gcode);
  const machineState = useCncStore((s) => s.machineState);
  const isRunning = machineState === 'running' || machineState === 'simulating';

  return (
    <GcodeEditorPanel
      filename={gcode.filename}
      text={gcode.text}
      dirty={gcode.dirty}
      activeExecLine={gcode.currentLine > 0 ? gcode.currentLine : null}
      selectedLine={gcode.selectedLine}
      theme={theme}
      readOnly={isRunning}
      onChangeText={(text) => controller.setGcodeText(text)}
      onCursorLineChange={(line) => {
        if (!isRunning) {
          controller.store.getState().setGcode({ selectedLine: line });
        }
      }}
      onOpenDialog={() => onOpenFileDialog('open')}
      onSave={() => {
        if (gcode.filename) void controller.saveGcodeFile();
        else onOpenFileDialog('save-as');
      }}
      onSaveAsDialog={() => onOpenFileDialog('save-as')}
      onDropLocalFile={(filename, content) => {
        controller.setGcodeText(content, `gcode/${filename}`);
      }}
    />
  );
};

const LogsDockPanel: React.FC = () => {
  const { controller } = useCncRuntime();
  const logs = useCncStore((s) => s.logs);

  return (
    <LogsPanel
      consoleLogs={logs.console}
      errorLogs={logs.error}
      statusLogs={logs.status}
      rawLogs={logs.raw}
      onClear={(channel) => controller.store.getState().clearLogs(channel)}
    />
  );
};

export const CncWorkspaceView: React.FC<CncWorkspaceViewProps> = ({
  profileId,
  theme,
  resetLayoutNonce,
  machineBounds,
  onOpenFileDialog,
}) => {
  const profile = UI_PROFILES[profileId];
  const dockApiRef = useRef<DockviewApi | null>(null);
  const lastResetNonceRef = useRef(resetLayoutNonce);

  // Sync profile's default diameter mode when switching profiles
  const { controller } = useCncRuntime();
  useEffect(() => {
    controller.setDiameterMode(profile.defaultDiameterMode);
  }, [controller, profile.defaultDiameterMode]);

  // Reset layout when requested from TopBar
  useEffect(() => {
    if (resetLayoutNonce !== lastResetNonceRef.current) {
      lastResetNonceRef.current = resetLayoutNonce;
      clearSavedLayout(profileId);
      if (dockApiRef.current) {
        applyDefaultDockviewLayout(dockApiRef.current, profileId);
      }
    }
  }, [resetLayoutNonce, profileId]);

  const panelPropsRef = useRef({ profileId, theme, machineBounds, onOpenFileDialog });
  panelPropsRef.current = { profileId, theme, machineBounds, onOpenFileDialog };

  const components = useMemo<Record<string, React.FunctionComponent<IDockviewPanelProps>>>(
    () => ({
      dro: () => <DroDockPanel profileId={panelPropsRef.current.profileId} />,
      controls: () => <ControlsDockPanel profileId={panelPropsRef.current.profileId} />,
      jog: () => <JogDockPanel profileId={panelPropsRef.current.profileId} />,
      'viewer-3d': () => (
        <ViewerDockPanel
          profileId={panelPropsRef.current.profileId}
          theme={panelPropsRef.current.theme}
          machineBounds={panelPropsRef.current.machineBounds}
        />
      ),
      'gcode-editor': () => (
        <GcodeDockPanel
          theme={panelPropsRef.current.theme}
          onOpenFileDialog={panelPropsRef.current.onOpenFileDialog}
        />
      ),
      logs: () => <LogsDockPanel />,
    }),
    [],
  );

  const handleReady = useCallback(
    (event: DockviewReadyEvent) => {
      const api = event.api;
      dockApiRef.current = api;

      const saved = loadSavedLayout(profileId);
      if (saved) {
        try {
          api.fromJSON(saved);
        } catch {
          applyDefaultDockviewLayout(api, profileId);
        }
      } else {
        applyDefaultDockviewLayout(api, profileId);
      }

      api.onDidLayoutChange(() => {
        try {
          saveLayout(profileId, api.toJSON());
        } catch {
          // ignore
        }
      });
    },
    [profileId],
  );

  // Touch Big Jog: Responsive CSS Grid Layout
  if (profile.layoutMode === 'touch-grid') {
    return (
      <div className="grid h-full grid-cols-1 gap-2 overflow-y-auto p-2 md:grid-cols-12 md:grid-rows-12 md:overflow-hidden">
        <div className="overflow-hidden rounded-lg border border-[var(--border-default)] md:col-span-4 md:row-span-6">
          <DroDockPanel profileId={profileId} touchMode />
        </div>
        <div className="overflow-hidden rounded-lg border border-[var(--border-default)] md:col-span-4 md:row-span-6">
          <JogDockPanel profileId={profileId} touchMode />
        </div>
        <div className="overflow-hidden rounded-lg border border-[var(--border-default)] md:col-span-4 md:row-span-6">
          <ControlsDockPanel profileId={profileId} />
        </div>
        <div className="min-h-[260px] overflow-hidden rounded-lg border border-[var(--border-default)] md:col-span-7 md:row-span-6">
          <ViewerDockPanel profileId={profileId} theme={theme} machineBounds={machineBounds} />
        </div>
        <div className="min-h-[220px] overflow-hidden rounded-lg border border-[var(--border-default)] md:col-span-5 md:row-span-6">
          <GcodeDockPanel theme={theme} onOpenFileDialog={onOpenFileDialog} />
        </div>
      </div>
    );
  }

  // Standard Dockview Layout (keyed by profileId so switching profiles loads that profile's layout)
  return (
    <div className="kmx-dockview h-full w-full">
      <DockviewReact
        key={`${profileId}-${theme}`}
        className="h-full w-full"
        components={components}
        onReady={handleReady}
      />
    </div>
  );
};
