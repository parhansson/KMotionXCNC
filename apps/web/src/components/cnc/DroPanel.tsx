import React from 'react';
import { Crosshair, CircleDot, CheckCircle2, Ruler } from 'lucide-react';
import type { AxisKey } from '../../profiles/ui-profiles';

const FIXTURES = ['G54', 'G55', 'G56', 'G57', 'G58', 'G59', 'G59.1', 'G59.2', 'G59.3'] as const;
const ROTARY_AXES = new Set<AxisKey>(['A', 'B', 'C']);

export interface DroPanelProps {
  axes: AxisKey[];
  machinePos: Record<AxisKey, number>;
  workPos: Record<AxisKey, number>;
  followingError: Record<AxisKey, number>;
  enablesMask: number;
  axisDoneMask: number;
  coordMode: 'machine' | 'work';
  onCoordModeChange: (mode: 'machine' | 'work') => void;
  fixture: string;
  onFixtureChange: (fixture: string) => void;
  displayUnit: 'mm' | 'in';
  onToggleUnit: () => void;
  diameterMode: boolean;
  onToggleDiameterMode: () => void;
  canZero: boolean;
  onZeroAxis: (axis: AxisKey) => void;
  onZeroAll: () => void;
  touchMode?: boolean;
}

const ALL_AXES_ORDER: AxisKey[] = ['X', 'Y', 'Z', 'A', 'B', 'C', 'U', 'V'];

function formatAxisValue(valueMm: number, axis: AxisKey, unit: 'mm' | 'in', diameterMode: boolean): string {
  if (ROTARY_AXES.has(axis)) {
    return valueMm.toFixed(3);
  }
  const scaled = axis === 'X' && diameterMode ? valueMm * 2 : valueMm;
  const converted = unit === 'in' ? scaled / 25.4 : scaled;
  return converted.toFixed(unit === 'in' ? 4 : 3);
}

export const DroPanel: React.FC<DroPanelProps> = ({
  axes,
  machinePos,
  workPos,
  followingError,
  enablesMask,
  axisDoneMask,
  coordMode,
  onCoordModeChange,
  fixture,
  onFixtureChange,
  displayUnit,
  onToggleUnit,
  diameterMode,
  onToggleDiameterMode,
  canZero,
  onZeroAxis,
  onZeroAll,
  touchMode = false,
}) => {
  const posSource = coordMode === 'work' ? workPos : machinePos;

  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto bg-[var(--bg-panel)] p-[var(--panel-padding)]">
      {/* Header Controls: Work/Machine, Fixture, Unit, Diameter */}
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <div className="flex overflow-hidden rounded border border-[var(--border-default)] bg-[var(--bg-surface)]">
          <button
            type="button"
            onClick={() => onCoordModeChange('work')}
            className={`px-2 py-1 text-[11px] font-bold uppercase transition ${
              coordMode === 'work'
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Work
          </button>
          <button
            type="button"
            onClick={() => onCoordModeChange('machine')}
            className={`px-2 py-1 text-[11px] font-bold uppercase transition ${
              coordMode === 'machine'
                ? 'bg-amber-500/20 text-amber-400'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Machine
          </button>
        </div>

        <div className="flex items-center gap-1">
          <select
            aria-label="Active Fixture"
            value={fixture}
            onChange={(e) => onFixtureChange(e.target.value)}
            disabled={!canZero}
            className="rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-1.5 py-1 font-mono-tabular text-[11px] font-bold text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none disabled:opacity-50"
          >
            {FIXTURES.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={onToggleUnit}
            title="Toggle display units (mm / in)"
            className="flex items-center gap-1 rounded border border-[var(--border-default)] bg-[var(--bg-elevated)] px-2 py-1 font-mono-tabular text-[11px] font-bold uppercase text-[var(--accent-cyan)] hover:border-[var(--border-strong)]"
          >
            <Ruler className="h-3 w-3" />
            {displayUnit}
          </button>

          <button
            type="button"
            onClick={onToggleDiameterMode}
            title="Toggle Lathe Diameter Mode (X × 2)"
            className={`rounded border px-1.5 py-1 font-mono-tabular text-[11px] font-bold transition ${
              diameterMode
                ? 'border-purple-400/60 bg-purple-500/20 text-purple-300'
                : 'border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            Ø
          </button>
        </div>
      </div>

      {/* Axis Readouts */}
      <div className="flex flex-1 flex-col gap-1.5">
        {axes.map((axis) => {
          const bitIdx = ALL_AXES_ORDER.indexOf(axis);
          const enabled = (enablesMask & (1 << bitIdx)) !== 0;
          const done = (axisDoneMask & (1 << bitIdx)) !== 0;
          const val = posSource[axis] ?? 0;
          const ferr = followingError[axis] ?? 0;
          const isRotary = ROTARY_AXES.has(axis);
          const unitLabel = isRotary ? 'deg' : displayUnit;

          return (
            <div
              key={axis}
              className="flex items-center justify-between gap-2 rounded-md border border-[var(--border-subtle)] bg-[var(--dro-bg)] px-2.5 py-1.5"
            >
              <div className="flex items-center gap-2">
                <div className="flex flex-col items-center">
                  <span
                    className={`font-mono-tabular font-black leading-none ${
                      touchMode ? 'text-xl' : 'text-base'
                    } ${
                      axis === 'X'
                        ? 'text-red-400'
                        : axis === 'Y'
                          ? 'text-emerald-400'
                          : axis === 'Z'
                            ? 'text-sky-400'
                            : 'text-purple-400'
                    }`}
                  >
                    {axis}
                    {axis === 'X' && diameterMode ? 'Ø' : ''}
                  </span>
                  <div className="mt-1 flex items-center gap-1" title={`Enabled: ${enabled} | Done: ${done}`}>
                    <CircleDot
                      className={`h-2.5 w-2.5 ${enabled ? 'text-emerald-400' : 'text-slate-600'}`}
                    />
                    <CheckCircle2
                      className={`h-2.5 w-2.5 ${done ? 'text-cyan-400' : 'text-amber-400'}`}
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-1 flex-col items-end">
                <div className="flex items-baseline gap-1.5">
                  <span
                    style={{ fontSize: 'var(--font-size-dro)' }}
                    className={`font-mono-tabular font-bold tracking-tight leading-none ${
                      coordMode === 'work' ? 'text-[var(--dro-work)]' : 'text-[var(--dro-machine)]'
                    }`}
                  >
                    {formatAxisValue(val, axis, displayUnit, diameterMode)}
                  </span>
                  <span className="text-[10px] font-semibold uppercase text-slate-500">
                    {unitLabel}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 font-mono-tabular text-[10px] text-slate-400">
                  <span>
                    {coordMode === 'work' ? 'M' : 'W'}:{' '}
                    {formatAxisValue(
                      (coordMode === 'work' ? machinePos[axis] : workPos[axis]) ?? 0,
                      axis,
                      displayUnit,
                      diameterMode,
                    )}
                  </span>
                  <span className={Math.abs(ferr) > 0.05 ? 'text-amber-400' : 'text-slate-500'}>
                    Δ {ferr.toFixed(3)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                disabled={!canZero}
                onClick={() => onZeroAxis(axis)}
                title={`Zero ${axis} work coordinate`}
                className="btn-workshop !min-h-7 !px-2 !text-[11px] !border-slate-700 !bg-slate-800/80 !text-slate-200 hover:!bg-slate-700"
              >
                0
              </button>
            </div>
          );
        })}
      </div>

      {/* Footer: Zero All */}
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <span className="text-[11px] text-[var(--text-muted)]">
          Active: <strong className="text-[var(--text-secondary)]">{fixture}</strong>
        </span>
        <button
          type="button"
          disabled={!canZero}
          onClick={onZeroAll}
          className="btn-workshop !min-h-7 !px-2.5 !text-xs"
        >
          <Crosshair className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
          Zero All
        </button>
      </div>
    </div>
  );
};
