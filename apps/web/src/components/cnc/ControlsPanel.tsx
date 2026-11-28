import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Pause,
  Play,
  RotateCcw,
  Send,
  Slash,
  Square,
  StepForward,
  Zap,
} from 'lucide-react';
import type { PreflightResult } from '@kmxcnc/igm';

export interface UserButtonItem {
  index: number;
  name: string;
}

export interface ControlsPanelProps {
  machineState: string;
  canCycleStart: boolean;
  canHalt: boolean;
  canFeedHold: boolean;
  canStep: boolean;
  canReset: boolean;
  canMdi: boolean;
  blockDelete: boolean;
  onToggleBlockDelete: () => void;
  onCycleStart: () => void;
  onHalt: () => void;
  onFeedHold: () => void;
  onStep: () => void;
  onReset: () => void;
  onSendMdi: (line: string) => void;
  fro: number;
  sso: number;
  onFroChange: (val: number) => void;
  onSsoChange: (val: number) => void;
  showSpindleOverride?: boolean;
  preflight: PreflightResult | null;
  userButtons: UserButtonItem[];
  onInvokeUserButton: (actionIndex: number) => void;
}

function formatDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '0s';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export const ControlsPanel: React.FC<ControlsPanelProps> = ({
  machineState,
  canCycleStart,
  canHalt,
  canFeedHold,
  canStep,
  canReset,
  canMdi,
  blockDelete,
  onToggleBlockDelete,
  onCycleStart,
  onHalt,
  onFeedHold,
  onStep,
  onReset,
  onSendMdi,
  fro,
  sso,
  onFroChange,
  onSsoChange,
  showSpindleOverride = true,
  preflight,
  userButtons,
  onInvokeUserButton,
}) => {
  const [mdiInput, setMdiInput] = useState('');
  const isRunning = machineState === 'running' || machineState === 'simulating';
  const isFeedHold = machineState === 'feedhold';

  const handleMdiSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = mdiInput.trim();
    if (!trimmed || !canMdi) return;
    onSendMdi(trimmed);
    setMdiInput('');
  };

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto bg-[var(--bg-panel)] p-[var(--panel-padding)]">
      {/* Primary Execution Buttons */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={!canCycleStart}
          onClick={onCycleStart}
          className="btn-workshop !min-h-[var(--control-height-lg)] !bg-emerald-600 !text-white !border-emerald-400/50 hover:!bg-emerald-500"
        >
          <Play className="h-4 w-4 fill-current" />
          Cycle Start
        </button>

        <button
          type="button"
          disabled={!canFeedHold}
          onClick={onFeedHold}
          className={`btn-workshop !min-h-[var(--control-height-lg)] ${
            isFeedHold
              ? '!bg-amber-500 !text-slate-950 !border-amber-300'
              : '!bg-amber-500/20 !text-amber-300 !border-amber-500/50 hover:!bg-amber-500/30'
          }`}
        >
          <Pause className="h-4 w-4" />
          {isFeedHold ? 'Resume' : 'Feed Hold'}
        </button>
      </div>

      {/* Secondary Controls */}
      <div className="grid grid-cols-4 gap-1.5">
        <button
          type="button"
          disabled={!canHalt && !isRunning}
          onClick={onHalt}
          className="btn-workshop !px-2 !text-xs"
          title="Halt execution cleanly"
        >
          <Square className="h-3.5 w-3.5 text-red-400" />
          Halt
        </button>

        <button
          type="button"
          disabled={!canStep}
          onClick={onStep}
          className="btn-workshop !px-2 !text-xs"
          title="Single-block step"
        >
          <StepForward className="h-3.5 w-3.5 text-cyan-400" />
          Step
        </button>

        <button
          type="button"
          disabled={!canReset}
          onClick={onReset}
          className="btn-workshop !px-2 !text-xs"
          title="Reset interpreter & clear halt/estop"
        >
          <RotateCcw className="h-3.5 w-3.5 text-amber-400" />
          Reset
        </button>

        <button
          type="button"
          onClick={onToggleBlockDelete}
          title="Toggle Block Delete (skip lines starting with /)"
          className={`btn-workshop !px-2 !text-xs ${
            blockDelete
              ? '!border-amber-400/70 !bg-amber-500/20 !text-amber-300'
              : ''
          }`}
        >
          <Slash className="h-3.5 w-3.5" />
          Blk
        </button>
      </div>

      {/* MDI Command Input */}
      <form onSubmit={handleMdiSubmit} className="flex items-center gap-1.5">
        <input
          type="text"
          value={mdiInput}
          onChange={(e) => setMdiInput(e.target.value)}
          disabled={!canMdi}
          placeholder="MDI: e.g. G0 X10 Y10"
          className="flex-1 rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2.5 py-1.5 font-mono-tabular text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none disabled:opacity-45"
        />
        <button
          type="submit"
          disabled={!canMdi || !mdiInput.trim()}
          className="btn-workshop !min-h-8 !px-2.5 !text-xs"
        >
          <Send className="h-3.5 w-3.5 text-[var(--accent-cyan)]" />
          MDI
        </button>
      </form>

      {/* Overrides: FRO & SSO */}
      <div className="space-y-2 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2.5">
        <div>
          <div className="mb-1 flex items-center justify-between text-[11px]">
            <span className="font-semibold text-[var(--text-secondary)]">Feed Override (FRO)</span>
            <span className="font-mono-tabular font-bold text-[var(--accent-cyan)]">
              {Math.round(fro * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0.1}
            max={2}
            step={0.05}
            value={fro}
            onChange={(e) => onFroChange(Number(e.target.value))}
            className="h-1.5 w-full cursor-pointer accent-cyan-400"
          />
        </div>

        {showSpindleOverride && (
          <div>
            <div className="mb-1 flex items-center justify-between text-[11px]">
              <span className="font-semibold text-[var(--text-secondary)]">
                Spindle Override (SSO)
              </span>
              <span className="font-mono-tabular font-bold text-[var(--accent-amber)]">
                {Math.round(sso * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0.1}
              max={2}
              step={0.05}
              value={sso}
              onChange={(e) => onSsoChange(Number(e.target.value))}
              className="h-1.5 w-full cursor-pointer accent-amber-400"
            />
          </div>
        )}
      </div>

      {/* Pre-flight Analysis Summary */}
      {preflight && (
        <div
          className={`rounded-md border p-2.5 text-xs ${
            !preflight.ok
              ? 'border-red-500/50 bg-red-500/10'
              : preflight.warnings.length > 0
                ? 'border-amber-500/40 bg-amber-500/10'
                : 'border-emerald-500/35 bg-emerald-500/10'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 font-bold">
              {preflight.ok ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
              )}
              Pre-Flight {preflight.ok ? 'OK' : `${preflight.errors.length} Limit Error(s)`}
            </span>
            <span className="flex items-center gap-1 font-mono-tabular text-[11px] text-[var(--text-secondary)]">
              <Clock className="h-3 w-3" />~{formatDuration(preflight.estimatedTimeSec)}
            </span>
          </div>

          <div className="mt-1.5 grid grid-cols-2 gap-1 font-mono-tabular text-[11px] text-[var(--text-secondary)]">
            <span>Rapid: {preflight.rapidDistanceMm.toFixed(1)} mm</span>
            <span>Cut: {preflight.cutDistanceMm.toFixed(1)} mm</span>
            {!preflight.bounds.empty && (
              <span className="col-span-2 text-[10px] text-[var(--text-muted)]">
                X[{preflight.bounds.min.x.toFixed(1)}..{preflight.bounds.max.x.toFixed(1)}] Y[
                {preflight.bounds.min.y.toFixed(1)}..{preflight.bounds.max.y.toFixed(1)}] Z[
                {preflight.bounds.min.z.toFixed(1)}..{preflight.bounds.max.z.toFixed(1)}]
              </span>
            )}
          </div>

          {preflight.errors.slice(0, 2).map((err, i) => (
            <div key={i} className="mt-1 text-[11px] text-red-300">
              • {err.message}
            </div>
          ))}
        </div>
      )}

      {/* Dynamic User Buttons */}
      {userButtons.length > 0 && (
        <div>
          <div className="mb-1.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            <Zap className="h-3 w-3 text-[var(--accent-primary)]" />
            User Actions
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {userButtons.map((btn) => (
              <button
                key={btn.index}
                type="button"
                onClick={() => onInvokeUserButton(btn.index)}
                className="btn-workshop !min-h-7 !px-2 !text-xs truncate"
              >
                {btn.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
