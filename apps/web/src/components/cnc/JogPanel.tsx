import React, { useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Keyboard, Move } from 'lucide-react';
import type { AxisKey } from '../../profiles/ui-profiles';

const STEP_SIZES_MM = [0.01, 0.1, 1, 10] as const;

export interface JogPanelProps {
  axes: AxisKey[];
  canJog: boolean;
  keyboardEnabled: boolean;
  onToggleKeyboard: () => void;
  onStartContinuousJog: (axis: AxisKey, direction: 1 | -1, fast: boolean) => void;
  onStopContinuousJog: (axis: AxisKey) => void;
  onStepJog: (axis: AxisKey, deltaMm: number) => void;
  touchMode?: boolean;
}

export const JogPanel: React.FC<JogPanelProps> = ({
  axes,
  canJog,
  keyboardEnabled,
  onToggleKeyboard,
  onStartContinuousJog,
  onStopContinuousJog,
  onStepJog,
  touchMode = false,
}) => {
  const [jogMode, setJogMode] = useState<'continuous' | 'step'>('continuous');
  const [fast, setFast] = useState(false);
  const [stepSize, setStepSize] = useState<number>(1);

  const hasY = axes.includes('Y');
  const hasZ = axes.includes('Z');
  const extraAxes = axes.filter((a) => !['X', 'Y', 'Z'].includes(a));

  const bindJogHandlers = (axis: AxisKey, dir: 1 | -1) => {
    if (jogMode === 'step') {
      return {
        onClick: () => {
          if (canJog) onStepJog(axis, dir * stepSize);
        },
      };
    }
    return {
      onPointerDown: (e: React.PointerEvent) => {
        if (!canJog) return;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        onStartContinuousJog(axis, dir, fast);
      },
      onPointerUp: () => onStopContinuousJog(axis),
      onPointerCancel: () => onStopContinuousJog(axis),
      onLostPointerCapture: () => onStopContinuousJog(axis),
    };
  };

  const btnSizeStyle: React.CSSProperties = {
    minWidth: 'var(--jog-btn-size)',
    minHeight: 'var(--jog-btn-size)',
  };

  return (
    <div className="flex h-full flex-col gap-2.5 overflow-y-auto bg-[var(--bg-panel)] p-[var(--panel-padding)]">
      {/* Top Mode & Keyboard Controls */}
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <div className="flex overflow-hidden rounded border border-[var(--border-default)] bg-[var(--bg-surface)]">
          <button
            type="button"
            onClick={() => setJogMode('continuous')}
            className={`px-2 py-1 text-[11px] font-bold uppercase ${
              jogMode === 'continuous'
                ? 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]'
                : 'text-[var(--text-secondary)]'
            }`}
          >
            Hold
          </button>
          <button
            type="button"
            onClick={() => setJogMode('step')}
            className={`px-2 py-1 text-[11px] font-bold uppercase ${
              jogMode === 'step'
                ? 'bg-cyan-500/20 text-cyan-300'
                : 'text-[var(--text-secondary)]'
            }`}
          >
            Step
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {jogMode === 'continuous' && (
            <button
              type="button"
              onClick={() => setFast((f) => !f)}
              className={`rounded border px-2 py-1 text-[11px] font-bold uppercase ${
                fast
                  ? 'border-amber-400/70 bg-amber-500/20 text-amber-300'
                  : 'border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)]'
              }`}
            >
              {fast ? 'Fast' : 'Slow'}
            </button>
          )}

          <button
            type="button"
            onClick={onToggleKeyboard}
            title="Toggle keyboard jogging (Arrows = X/Y, PgUp/PgDn = Z, Space = Feed Hold)"
            className={`flex items-center gap-1 rounded border px-2 py-1 text-[11px] font-semibold ${
              keyboardEnabled
                ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-300'
                : 'border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-muted)]'
            }`}
          >
            <Keyboard className="h-3.5 w-3.5" />
            KB
          </button>
        </div>
      </div>

      {/* Step Size Selector */}
      {jogMode === 'step' && (
        <div className="grid grid-cols-4 gap-1">
          {STEP_SIZES_MM.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => setStepSize(size)}
              className={`rounded border py-1 font-mono-tabular text-xs font-bold transition ${
                stepSize === size
                  ? 'border-cyan-400/70 bg-cyan-500/20 text-cyan-300'
                  : 'border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)]'
              }`}
            >
              {size}mm
            </button>
          ))}
        </div>
      )}

      {/* Main XY + Z Pad */}
      <div className="flex flex-1 items-center justify-center gap-4">
        {/* XY Cross */}
        <div className="grid grid-cols-3 gap-1.5">
          <div />
          {hasY ? (
            <button
              type="button"
              disabled={!canJog}
              style={btnSizeStyle}
              className="btn-workshop flex-col !p-1"
              {...bindJogHandlers('Y', 1)}
            >
              <ArrowUp className="h-4 w-4 text-emerald-400" />
              <span className="text-[10px] font-bold">Y+</span>
            </button>
          ) : (
            <div />
          )}
          <div />

          <button
            type="button"
            disabled={!canJog}
            style={btnSizeStyle}
            className="btn-workshop flex-col !p-1"
            {...bindJogHandlers('X', -1)}
          >
            <ArrowLeft className="h-4 w-4 text-red-400" />
            <span className="text-[10px] font-bold">X-</span>
          </button>

          <div
            style={btnSizeStyle}
            className="flex items-center justify-center rounded-md border border-dashed border-[var(--border-subtle)] text-[var(--text-muted)]"
          >
            <Move className="h-4 w-4" />
          </div>

          <button
            type="button"
            disabled={!canJog}
            style={btnSizeStyle}
            className="btn-workshop flex-col !p-1"
            {...bindJogHandlers('X', 1)}
          >
            <ArrowRight className="h-4 w-4 text-red-400" />
            <span className="text-[10px] font-bold">X+</span>
          </button>

          <div />
          {hasY ? (
            <button
              type="button"
              disabled={!canJog}
              style={btnSizeStyle}
              className="btn-workshop flex-col !p-1"
              {...bindJogHandlers('Y', -1)}
            >
              <ArrowDown className="h-4 w-4 text-emerald-400" />
              <span className="text-[10px] font-bold">Y-</span>
            </button>
          ) : (
            <div />
          )}
          <div />
        </div>

        {/* Z Column */}
        {hasZ && (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={!canJog}
              style={btnSizeStyle}
              className="btn-workshop flex-col !p-1"
              {...bindJogHandlers('Z', 1)}
            >
              <ArrowUp className="h-4 w-4 text-sky-400" />
              <span className="text-[10px] font-bold">Z+</span>
            </button>
            <button
              type="button"
              disabled={!canJog}
              style={btnSizeStyle}
              className="btn-workshop flex-col !p-1"
              {...bindJogHandlers('Z', -1)}
            >
              <ArrowDown className="h-4 w-4 text-sky-400" />
              <span className="text-[10px] font-bold">Z-</span>
            </button>
          </div>
        )}
      </div>

      {/* Extra Axes (A, B, C, U, V) */}
      {extraAxes.length > 0 && (
        <div className="grid grid-cols-2 gap-1.5 border-t border-[var(--border-subtle)] pt-2">
          {extraAxes.map((axis) => (
            <div key={axis} className="flex items-center gap-1">
              <button
                type="button"
                disabled={!canJog}
                className="btn-workshop flex-1 !min-h-7 !px-1.5 !text-xs"
                {...bindJogHandlers(axis, -1)}
              >
                {axis}-
              </button>
              <button
                type="button"
                disabled={!canJog}
                className="btn-workshop flex-1 !min-h-7 !px-1.5 !text-xs"
                {...bindJogHandlers(axis, 1)}
              >
                {axis}+
              </button>
            </div>
          ))}
        </div>
      )}

      {!touchMode && (
        <div className="text-center text-[10px] text-[var(--text-muted)]">
          Deadman heartbeat active while holding continuous jog
        </div>
      )}
    </div>
  );
};
