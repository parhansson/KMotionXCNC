import React from 'react';
import {
  Activity,
  Cpu,
  Flame,
  FolderInput,
  LayoutGrid,
  Moon,
  OctagonX,
  RotateCcw,
  Settings,
  Sliders,
  Sparkles,
  Sun,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { UI_PROFILE_LIST, type UiProfileId } from '../../profiles/ui-profiles';

export type AppViewId = 'cnc' | 'cam' | 'generators' | 'laser' | 'kflop';

export interface TopBarProps {
  activeView: AppViewId;
  onViewChange: (view: AppViewId) => void;
  machineState: string;
  connectionLabel: string;
  connected: boolean;
  simulate: boolean;
  onToggleSimulate: () => void;
  canToggleSimulate: boolean;
  onOpenConnection: () => void;
  profileId: UiProfileId;
  onProfileChange: (id: UiProfileId) => void;
  onResetLayout?: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onEmergencyStop: () => void;
  canEstop: boolean;
}

const STATE_BADGE_STYLES: Record<string, string> = {
  idle: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40',
  running: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/50 animate-pulse',
  simulating: 'bg-blue-500/20 text-blue-300 border-blue-400/50',
  feedhold: 'bg-amber-500/20 text-amber-300 border-amber-400/50',
  halted: 'bg-amber-500/15 text-amber-400 border-amber-500/40',
  estop: 'bg-red-600/25 text-red-400 border-red-500/60',
  offline: 'bg-purple-500/15 text-purple-300 border-purple-500/40',
  disconnected: 'bg-slate-500/15 text-slate-400 border-slate-500/40',
};

const NAV_TABS: { id: AppViewId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'cnc', label: 'CNC Control', icon: Sliders },
  { id: 'cam', label: 'Import & CAM', icon: FolderInput },
  { id: 'kflop', label: 'KFLOP & Config', icon: Settings },
  { id: 'generators', label: 'Generators', icon: Sparkles },
  { id: 'laser', label: 'Laser', icon: Flame },
];

export const TopBar: React.FC<TopBarProps> = ({
  activeView,
  onViewChange,
  machineState,
  connectionLabel,
  connected,
  simulate,
  onToggleSimulate,
  canToggleSimulate,
  onOpenConnection,
  profileId,
  onProfileChange,
  onResetLayout,
  theme,
  onToggleTheme,
  onEmergencyStop,
  canEstop,
}) => {
  const badgeStyle = STATE_BADGE_STYLES[machineState] ?? STATE_BADGE_STYLES.disconnected;

  return (
    <header className="flex h-13 shrink-0 items-center justify-between gap-2 border-b border-[var(--border-default)] bg-[var(--bg-surface)] px-3">
      {/* Left: Brand + Primary Navigation */}
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-500/15 ring-1 ring-amber-500/40">
            <Cpu className="h-4.5 w-4.5 text-[var(--accent-primary)]" />
          </div>
          <div className="hidden sm:block leading-tight">
            <div className="text-sm font-black tracking-wide text-[var(--text-primary)]">
              KMX<span className="text-[var(--accent-primary)]">CNC</span>
            </div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Workshop
            </div>
          </div>
        </div>

        <nav aria-label="Main views" className="flex items-center gap-1 overflow-x-auto">
          {NAV_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeView === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onViewChange(tab.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
                  active
                    ? 'bg-[var(--bg-elevated)] text-[var(--accent-primary)] ring-1 ring-[var(--border-strong)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden md:inline">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Right: Connection, State, Simulate, Profile, Theme, E-STOP */}
      <div className="flex shrink-0 items-center gap-2">
        {/* Connection Pill */}
        <button
          type="button"
          onClick={onOpenConnection}
          title="Configure backend connection & capabilities"
          className="flex items-center gap-1.5 rounded-full border border-[var(--border-default)] bg-[var(--bg-panel)] px-2.5 py-1 text-xs font-medium text-[var(--text-primary)] transition hover:border-[var(--accent-primary)]"
        >
          {connected ? (
            <Wifi className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <WifiOff className="h-3.5 w-3.5 text-slate-400" />
          )}
          <span className="hidden max-w-[130px] truncate lg:inline">{connectionLabel}</span>
        </button>

        {/* Machine State Badge */}
        <div
          title={`Machine State: ${machineState}`}
          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono-tabular text-[11px] font-bold uppercase tracking-wider ${badgeStyle}`}
        >
          <Activity className="h-3 w-3" />
          <span>{machineState}</span>
        </div>

        {/* Simulate Toggle */}
        <button
          type="button"
          disabled={!canToggleSimulate}
          onClick={onToggleSimulate}
          title="Toggle Simulate mode (dry run without hardware motion)"
          className={`hidden items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold transition sm:flex ${
            simulate
              ? 'border-blue-400/60 bg-blue-500/20 text-blue-300'
              : 'border-[var(--border-default)] bg-[var(--bg-panel)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          } disabled:opacity-45`}
        >
          SIM {simulate ? 'ON' : 'OFF'}
        </button>

        {/* UI Profile Switcher */}
        <div className="hidden items-center gap-1 xl:flex">
          <LayoutGrid className="h-3.5 w-3.5 text-[var(--text-muted)]" />
          <select
            aria-label="UI Profile"
            value={profileId}
            onChange={(e) => onProfileChange(e.target.value as UiProfileId)}
            className="rounded border border-[var(--border-default)] bg-[var(--bg-panel)] px-2 py-1 text-xs font-medium text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
          >
            {UI_PROFILE_LIST.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          {activeView === 'cnc' && onResetLayout && profileId !== 'touch-big-jog' && (
            <button
              type="button"
              onClick={onResetLayout}
              title="Reset Dockview panel layout to default"
              className="rounded p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Theme Toggle */}
        <button
          type="button"
          onClick={onToggleTheme}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark Workshop'} theme`}
          className="rounded-md border border-[var(--border-default)] bg-[var(--bg-panel)] p-1.5 text-[var(--text-secondary)] transition hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        {/* Prominent E-STOP Button — Always Reachable */}
        <button
          type="button"
          disabled={!canEstop}
          onClick={onEmergencyStop}
          className="flex h-9 items-center gap-1.5 rounded-md border-2 border-red-400/80 bg-red-600 px-3.5 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-red-900/40 transition hover:bg-red-500 active:scale-95 disabled:opacity-40"
        >
          <OctagonX className="h-4 w-4" />
          <span>E-STOP</span>
        </button>
      </div>
    </header>
  );
};
