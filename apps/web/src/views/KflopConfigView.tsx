import React, { useEffect, useMemo, useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import {
  Activity,
  CheckCircle2,
  Code2,
  Cpu,
  Gauge,
  Play,
  Save,
  Settings2,
} from 'lucide-react';
import {
  ALL_CONNECTORS,
  decodeAnalogIo,
  decodeDigitalIo,
  decodeThreads,
  EXTENDED_MCODES,
  getActionTypeDef,
  KFLOP_ACTION_TYPES,
  KFLOP_AXES_8,
  SPECIAL_ACTIONS,
  STANDARD_MCODES,
  USER_BUTTON_COUNT,
  type MainStatusLike,
} from '@kmxcnc/plugin-kflop';
import {
  inchesToMm,
  mmToInches,
  type LengthUnit,
} from '@kmxcnc/cnc-core';
import { CodeMirrorEditor } from '../components/editor/CodeMirrorEditor';

const SAMPLE_C_PROGRAM = `#include "KMotionDef.h"

// KFLOP Initialization & Homing C-Program (Thread 1)
main() {
    // Configure Axis 0..2 Step/Dir outputs
    ch0->InputMode = NO_INPUT_MODE;
    ch0->OutputMode = STEP_DIR_MODE;
    ch0->Vel = 40000;
    ch0->Accel = 400000;
    ch0->Jerk = 4e6;
    EnableAxisDest(0, 0);
    EnableAxisDest(1, 0);
    EnableAxisDest(2, 0);

    DefineCoordSystem(0, 1, 2, -1);
    printf("KFLOP axes initialized.\\n");
}
`;

export interface MachineAxisSettings {
  countsPerUnit: number;
  maxVel: number;
  maxAccel: number;
  jogVel: number;
  softLimitNeg?: number;
  softLimitPos?: number;
  degrees?: boolean;
  radius?: number;
}

export interface MachineActionEditable {
  name: string;
  action: number;
  dParam0?: number;
  dParam1?: number;
  dParam2?: number;
  dParam3?: number;
  dParam4?: number;
  file?: string;
}

export interface MachineConfigEditable {
  name: string;
  description?: string;
  defaultUnit: LengthUnit;
  /** Machine envelope stored in inches (displayed in `defaultUnit`). */
  dimX: number;
  dimY: number;
  dimZ: number;
  axes: Record<string, MachineAxisSettings>;
  tplanner: {
    breakangle: number;
    cornertolerance: number;
    lookahead: number;
    collineartolerance: number;
    facetangle: number;
  };
  actions: MachineActionEditable[];
  specialActions: MachineActionEditable[];
  userActions: MachineActionEditable[];
  extendedActions: MachineActionEditable[];
}

const PARAM_KEYS = ['dParam0', 'dParam1', 'dParam2', 'dParam3', 'dParam4'] as const;

const ActionEditorRow: React.FC<{
  item: MachineActionEditable;
  label: string;
  editableName: boolean;
  onChange: (next: MachineActionEditable) => void;
}> = ({ item, label, editableName, onChange }) => {
  const def = getActionTypeDef(item.action);
  const hasParams = def.visible.some(Boolean);

  return (
    <div className="rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2 space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        {editableName ? (
          <input
            type="text"
            value={item.name}
            placeholder={label}
            onChange={(e) => onChange({ ...item, name: e.target.value })}
            className="w-36 rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-xs font-semibold"
          />
        ) : (
          <span className="inline-flex w-24 shrink-0 items-center justify-center rounded bg-[var(--bg-elevated)] px-2 py-1 font-mono-tabular text-xs font-bold text-[var(--accent-primary)]">
            {label}
          </span>
        )}

        <select
          value={item.action}
          onChange={(e) => onChange({ ...item, action: Number(e.target.value) })}
          className="min-w-52 flex-1 rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-xs"
        >
          {KFLOP_ACTION_TYPES.map((t) => (
            <option key={t.action} value={t.action}>
              {t.action}: {t.name}
            </option>
          ))}
        </select>
      </div>

      {hasParams && (
        <div className="flex flex-wrap items-end gap-2 pt-0.5">
          {PARAM_KEYS.map((key, pIdx) => {
            if (!def.visible[pIdx]) return null;
            return (
              <label key={key} className="flex flex-col gap-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  {def.paramNames[pIdx]}
                </span>
                <input
                  type="number"
                  step="any"
                  value={item[key] ?? 0}
                  onChange={(e) =>
                    onChange({
                      ...item,
                      [key]: e.target.value === '' ? 0 : Number(e.target.value),
                    })
                  }
                  className="w-20 rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 font-mono-tabular text-xs"
                />
              </label>
            );
          })}

          {def.visible[5] && (
            <label className="flex min-w-48 flex-1 flex-col gap-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                {def.paramNames[5] || 'File'}
              </span>
              <input
                type="text"
                value={item.file ?? ''}
                placeholder="c-programs/..."
                onChange={(e) => onChange({ ...item, file: e.target.value })}
                className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 font-mono-tabular text-xs"
              />
            </label>
          )}
        </div>
      )}
    </div>
  );
};

export interface KflopConfigViewProps {
  theme: 'dark' | 'light';
  mainStatus: MainStatusLike | null;
  machineConfig: MachineConfigEditable;
  canSaveMachineConfig: boolean;
  onSaveMachineConfig: (next: MachineConfigEditable) => Promise<void> | void;
  onLogMessage?: (msg: string) => void;
}

export const KflopConfigView: React.FC<KflopConfigViewProps> = ({
  theme,
  mainStatus,
  machineConfig,
  canSaveMachineConfig,
  onSaveMachineConfig,
  onLogMessage,
}) => {
  const [draft, setDraft] = useState<MachineConfigEditable>(machineConfig);
  const [actionGroup, setActionGroup] = useState<'user' | 'std' | 'special' | 'ext'>('user');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [cCode, setCCode] = useState(SAMPLE_C_PROGRAM);
  const [cFilename, setCFilename] = useState('c-programs/init_3axis.c');
  const [selectedThread, setSelectedThread] = useState(1);

  useEffect(() => {
    setDraft(machineConfig);
  }, [machineConfig]);

  const connectors = useMemo(() => decodeDigitalIo(mainStatus, ALL_CONNECTORS), [mainStatus]);
  const analog = useMemo(() => decodeAnalogIo(mainStatus), [mainStatus]);
  const threads = useMemo(() => decodeThreads(mainStatus), [mainStatus]);

  const unit = draft.defaultUnit;
  const roundDisplay = (v: number, dp = 4): number => Number(v.toFixed(dp));
  const lengthToUi = (inches: number, dp = 4): number =>
    unit === 'mm' ? roundDisplay(inchesToMm(inches), dp) : roundDisplay(inches, dp);
  const lengthFromUi = (val: number): number => (unit === 'mm' ? mmToInches(val) : val);
  const countsToUi = (countsPerInch: number, isRotary: boolean): number =>
    isRotary || unit === 'in'
      ? roundDisplay(countsPerInch, 4)
      : roundDisplay(mmToInches(countsPerInch), 4);
  const countsFromUi = (val: number, isRotary: boolean): number =>
    isRotary || unit === 'in' ? val : inchesToMm(val);

  const handleSaveConfig = async () => {
    if (!canSaveMachineConfig) return;
    if (draft.dimX <= 0 || draft.dimY <= 0 || draft.dimZ <= 0) {
      setSaveMessage('Validation error: Machine dimensions must be > 0.');
      return;
    }
    await onSaveMachineConfig(draft);
    setSaveMessage('Saved machine.json & notified controller.');
    setTimeout(() => setSaveMessage(null), 3000);
  };

  return (
    <Tabs.Root defaultValue="settings" className="flex h-full flex-col overflow-hidden">
      {/* Sub-navigation */}
      <div className="flex items-center justify-between border-b border-[var(--border-default)] bg-[var(--bg-surface)] px-4">
        <Tabs.List className="flex items-center gap-1">
          <Tabs.Trigger
            value="settings"
            className="flex items-center gap-1.5 border-b-2 border-transparent px-3 py-2.5 text-xs font-bold text-[var(--text-secondary)] data-[state=active]:border-[var(--accent-primary)] data-[state=active]:text-[var(--text-primary)]"
          >
            <Settings2 className="h-3.5 w-3.5" />
            Machine Settings (machine.json)
          </Tabs.Trigger>
          <Tabs.Trigger
            value="diagnostics"
            className="flex items-center gap-1.5 border-b-2 border-transparent px-3 py-2.5 text-xs font-bold text-[var(--text-secondary)] data-[state=active]:border-[var(--accent-primary)] data-[state=active]:text-[var(--text-primary)]"
          >
            <Cpu className="h-3.5 w-3.5" />
            Hardware Diagnostics (I/O &amp; Analog)
          </Tabs.Trigger>
          <Tabs.Trigger
            value="cprograms"
            className="flex items-center gap-1.5 border-b-2 border-transparent px-3 py-2.5 text-xs font-bold text-[var(--text-secondary)] data-[state=active]:border-[var(--accent-primary)] data-[state=active]:text-[var(--text-primary)]"
          >
            <Code2 className="h-3.5 w-3.5" />
            C-Programs &amp; Threads (1–7)
          </Tabs.Trigger>
        </Tabs.List>

        {/* Live ThreadActive Strip */}
        <div className="hidden items-center gap-1.5 md:flex">
          <span className="text-[11px] font-semibold text-[var(--text-muted)]">Threads:</span>
          {threads.map((t) => (
            <span
              key={t.thread}
              title={`Thread ${t.thread}: ${t.active ? 'Active' : 'Idle'}${t.runOnStartUp ? ' (Startup)' : ''}`}
              className={`flex h-6 w-6 items-center justify-center rounded font-mono-tabular text-[11px] font-bold ${
                t.active
                  ? 'bg-emerald-500/25 text-emerald-300 ring-1 ring-emerald-500/50'
                  : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'
              }`}
            >
              {t.thread}
            </span>
          ))}
        </div>
      </div>

      {/* Tab 1: Hardware Diagnostics */}
      <Tabs.Content value="diagnostics" className="flex-1 space-y-4 overflow-y-auto p-4">
        {/* KFLOP Connector Pinout Cards */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {connectors.map((conn) => (
            <div
              key={conn.id}
              className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-panel)] p-3"
            >
              <div className="mb-2 flex items-center justify-between border-b border-[var(--border-subtle)] pb-2">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-[var(--accent-primary)]" />
                  <h3 className="text-xs font-bold text-[var(--text-primary)]">{conn.name}</h3>
                </div>
                <span className="rounded bg-[var(--bg-elevated)] px-1.5 py-0.5 font-mono-tabular text-[10px] uppercase text-[var(--text-muted)]">
                  {conn.board}
                </span>
              </div>

              <div
                className={`grid gap-1.5 ${
                  conn.layout === 'dual-row'
                    ? 'grid-cols-2'
                    : conn.layout === 'grid'
                      ? 'grid-cols-4'
                      : 'grid-cols-2 sm:grid-cols-4'
                }`}
              >
                {conn.pins.map((pin) => {
                  const isIo = pin.kind === 'io';
                  const dotColor = !isIo
                    ? pin.kind === 'power'
                      ? 'bg-red-500'
                      : pin.kind === 'ground'
                        ? 'bg-slate-600'
                        : 'bg-amber-500'
                    : pin.state
                      ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]'
                      : 'bg-slate-700';

                  return (
                    <div
                      key={`${conn.id}-${pin.pinNumber}`}
                      title={`Pin ${pin.pinNumber} (${pin.name}): ${pin.description}`}
                      className="flex items-center justify-between gap-1.5 rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1 text-[11px]"
                    >
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotColor}`} />
                        <span className="font-mono-tabular text-[10px] text-[var(--text-muted)]">
                          P{pin.pinNumber}
                        </span>
                        <span className="truncate font-mono-tabular font-semibold text-[var(--text-primary)]">
                          {pin.name}
                        </span>
                      </div>
                      {isIo && (
                        <span
                          className={`shrink-0 rounded px-1 font-mono-tabular text-[9px] font-bold uppercase ${
                            pin.direction === 'output'
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-cyan-500/15 text-cyan-300'
                          }`}
                        >
                          {pin.direction === 'output' ? 'OUT' : 'IN'}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Analog / DAC / PWM Readouts */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {(
            [
              { title: 'ADC Channels', values: analog.adc.slice(0, 8), unit: 'cnt' },
              { title: 'DAC Channels', values: analog.dac.slice(0, 8), unit: 'cnt' },
              { title: 'PWM Channels', values: analog.pwm.slice(0, 8), unit: 'duty' },
            ] as const
          ).map((block) => (
            <div
              key={block.title}
              className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-panel)] p-3"
            >
              <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
                <Gauge className="h-3.5 w-3.5 text-[var(--accent-cyan)]" />
                {block.title}
              </div>
              <div className="grid grid-cols-2 gap-1.5 font-mono-tabular text-xs">
                {block.values.map((val, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded bg-[var(--bg-surface)] px-2 py-1"
                  >
                    <span className="text-[var(--text-muted)]">CH{idx}</span>
                    <span className="font-bold text-[var(--text-primary)]">
                      {val} <span className="text-[10px] font-normal text-[var(--text-muted)]">{block.unit}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Tabs.Content>

      {/* Tab 2: Machine Config Editor */}
      <Tabs.Content value="settings" className="flex-1 space-y-4 overflow-y-auto p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-panel)] p-3">
          <div>
            <h2 className="text-sm font-bold text-[var(--text-primary)]">
              Machine Configuration (`settings/machine.json`)
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              8-axis MOTION_PARAMS, soft limits, trajectory planner &amp; user actions
            </p>
          </div>
          <div className="flex items-center gap-2">
            {saveMessage && (
              <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {saveMessage}
              </span>
            )}
            <button
              type="button"
              disabled={!canSaveMachineConfig}
              onClick={() => void handleSaveConfig()}
              className="btn-workshop !bg-[var(--accent-primary)] !text-slate-950 !border-transparent"
            >
              <Save className="h-3.5 w-3.5" />
              Save &amp; Apply
            </button>
          </div>
        </div>

        {/* General & Envelope */}
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-panel)] p-4 sm:grid-cols-5 text-xs">
          <label className="flex flex-col gap-1 sm:col-span-5 md:col-span-1">
            <span className="font-semibold text-[var(--text-secondary)]">Machine Name</span>
            <input
              type="text"
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              className="rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2.5 py-1.5"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-semibold text-[var(--text-secondary)]">Machine Units</span>
            <select
              value={draft.defaultUnit}
              onChange={(e) =>
                setDraft((d) => ({ ...d, defaultUnit: e.target.value as LengthUnit }))
              }
              className="rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-primary)]"
            >
              <option value="mm">Millimeters (mm)</option>
              <option value="in">Inches (in)</option>
            </select>
          </label>
          {(['dimX', 'dimY', 'dimZ'] as const).map((k) => (
            <label key={k} className="flex flex-col gap-1">
              <span className="font-semibold text-[var(--text-secondary)]">
                Envelope {k.replace('dim', '')} ({unit})
              </span>
              <input
                type="number"
                step="any"
                min={0.01}
                value={lengthToUi(draft[k], 3)}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, [k]: lengthFromUi(Number(e.target.value)) }))
                }
                className="rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2.5 py-1.5 font-mono-tabular"
              />
            </label>
          ))}
        </div>

        {/* 8-Axis MOTION_PARAMS Table */}
        <div className="overflow-x-auto rounded-lg border border-[var(--border-default)] bg-[var(--bg-panel)] p-3">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
            8-Axis Motion Parameters &amp; Soft Limits (Linear: {unit}, Rotary A–C: deg)
          </h3>
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[var(--border-subtle)] text-[11px] uppercase text-[var(--text-muted)]">
              <tr>
                <th className="px-2 py-1.5">Axis</th>
                <th className="px-2 py-1.5">Counts/{unit}</th>
                <th className="px-2 py-1.5">Max Vel ({unit}/s)</th>
                <th className="px-2 py-1.5">Max Accel ({unit}/s²)</th>
                <th className="px-2 py-1.5">Jog Vel ({unit}/s)</th>
                <th className="px-2 py-1.5">Soft Lim - ({unit})</th>
                <th className="px-2 py-1.5">Soft Lim + ({unit})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] font-mono-tabular">
              {KFLOP_AXES_8.map((axis) => {
                const ax = draft.axes[axis] ?? {
                  countsPerUnit: 2540,
                  maxVel: 10,
                  maxAccel: 20,
                  jogVel: 5,
                  softLimitNeg: -1000,
                  softLimitPos: 1000,
                };
                const isRotary =
                  ax.degrees === true ||
                  (ax.degrees === undefined && (axis === 'A' || axis === 'B' || axis === 'C'));
                const updateAx = (patch: Partial<MachineAxisSettings>) =>
                  setDraft((d) => ({
                    ...d,
                    axes: { ...d.axes, [axis]: { ...ax, ...patch } },
                  }));
                return (
                  <tr key={axis}>
                    <td className="px-2 py-1.5 font-bold text-[var(--accent-primary)]">
                      {axis}
                      {isRotary && (
                        <span className="ml-1 text-[10px] font-normal text-[var(--text-muted)]">
                          deg
                        </span>
                      )}
                    </td>
                    {(
                      [
                        'countsPerUnit',
                        'maxVel',
                        'maxAccel',
                        'jogVel',
                        'softLimitNeg',
                        'softLimitPos',
                      ] as const
                    ).map((field) => {
                      const rawVal = ax[field] ?? 0;
                      const displayVal =
                        field === 'countsPerUnit'
                          ? countsToUi(rawVal, isRotary)
                          : isRotary
                            ? roundDisplay(rawVal, 4)
                            : lengthToUi(rawVal, 4);
                      return (
                        <td key={field} className="px-1.5 py-1">
                          <input
                            type="number"
                            step="any"
                            value={displayVal}
                            onChange={(e) => {
                              const num = Number(e.target.value);
                              const stored =
                                field === 'countsPerUnit'
                                  ? countsFromUi(num, isRotary)
                                  : isRotary
                                    ? num
                                    : lengthFromUi(num);
                              updateAx({ [field]: stored });
                            }}
                            className="w-24 rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-xs"
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Trajectory Planner & M-Code Reference */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-panel)] p-3 text-xs">
            <h3 className="mb-2 font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              Trajectory Planner (TP)
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { k: 'breakangle', label: 'Break Angle (deg)', isLength: false },
                  { k: 'cornertolerance', label: `Corner Tol (${unit})`, isLength: true },
                  { k: 'lookahead', label: 'Lookahead (s)', isLength: false },
                  { k: 'collineartolerance', label: `Collinear Tol (${unit})`, isLength: true },
                  { k: 'facetangle', label: 'Facet Angle (deg)', isLength: false },
                ] as const
              ).map(({ k, label, isLength }) => (
                <label key={k} className="flex flex-col gap-1">
                  <span className="text-[11px] text-[var(--text-secondary)]">{label}</span>
                  <input
                    type="number"
                    step="any"
                    value={isLength ? lengthToUi(draft.tplanner[k], 5) : draft.tplanner[k]}
                    onChange={(e) => {
                      const num = Number(e.target.value);
                      setDraft((d) => ({
                        ...d,
                        tplanner: {
                          ...d.tplanner,
                          [k]: isLength ? lengthFromUi(num) : num,
                        },
                      }));
                    }}
                    className="rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 font-mono-tabular"
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-panel)] p-3 text-xs">
            <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                User Buttons &amp; M-Code Actions
              </h3>
              <div className="flex flex-wrap items-center gap-1">
                {(
                  [
                    { id: 'user', label: `User Buttons (${USER_BUTTON_COUNT})` },
                    { id: 'std', label: `M0–M9, S (${STANDARD_MCODES.length})` },
                    { id: 'special', label: `Special (${SPECIAL_ACTIONS.length})` },
                    { id: 'ext', label: `M100–M119 (${EXTENDED_MCODES.length})` },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActionGroup(tab.id)}
                    className={`rounded px-2 py-1 text-[11px] font-semibold transition ${
                      actionGroup === tab.id
                        ? 'bg-[var(--accent-primary)] text-slate-950'
                        : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
              {actionGroup === 'user' &&
                Array.from({ length: Math.max(USER_BUTTON_COUNT, draft.userActions.length) }).map(
                  (_, idx) => {
                    const item: MachineActionEditable = draft.userActions[idx] ?? {
                      name: '',
                      action: 0,
                    };
                    return (
                      <ActionEditorRow
                        key={idx}
                        item={item}
                        label={`Button ${idx + 1}`}
                        editableName
                        onChange={(updated) => {
                          const next = Array.from(
                            { length: Math.max(USER_BUTTON_COUNT, draft.userActions.length) },
                            (__, i) => draft.userActions[i] ?? { name: '', action: 0 },
                          );
                          next[idx] = updated;
                          setDraft((d) => ({ ...d, userActions: next }));
                        }}
                      />
                    );
                  },
                )}

              {actionGroup === 'std' &&
                STANDARD_MCODES.map((code, idx) => {
                  const item: MachineActionEditable = draft.actions[idx] ?? {
                    name: code,
                    action: 0,
                  };
                  return (
                    <ActionEditorRow
                      key={code}
                      item={item}
                      label={code}
                      editableName={false}
                      onChange={(updated) => {
                        const next = STANDARD_MCODES.map(
                          (c, i) => draft.actions[i] ?? { name: c, action: 0 },
                        );
                        next[idx] = { ...updated, name: code };
                        setDraft((d) => ({ ...d, actions: next }));
                      }}
                    />
                  );
                })}

              {actionGroup === 'special' &&
                SPECIAL_ACTIONS.map((name, idx) => {
                  const item: MachineActionEditable = draft.specialActions[idx] ?? {
                    name,
                    action: 0,
                  };
                  return (
                    <ActionEditorRow
                      key={name}
                      item={item}
                      label={name}
                      editableName={false}
                      onChange={(updated) => {
                        const next = SPECIAL_ACTIONS.map(
                          (n, i) => draft.specialActions[i] ?? { name: n, action: 0 },
                        );
                        next[idx] = { ...updated, name };
                        setDraft((d) => ({ ...d, specialActions: next }));
                      }}
                    />
                  );
                })}

              {actionGroup === 'ext' &&
                EXTENDED_MCODES.map((code, idx) => {
                  const item: MachineActionEditable = draft.extendedActions[idx] ?? {
                    name: code,
                    action: 0,
                  };
                  return (
                    <ActionEditorRow
                      key={code}
                      item={item}
                      label={code}
                      editableName={false}
                      onChange={(updated) => {
                        const next = EXTENDED_MCODES.map(
                          (c, i) => draft.extendedActions[i] ?? { name: c, action: 0 },
                        );
                        next[idx] = { ...updated, name: code };
                        setDraft((d) => ({ ...d, extendedActions: next }));
                      }}
                    />
                  );
                })}
            </div>
          </div>
        </div>
      </Tabs.Content>

      {/* Tab 3: C-Program Editor & Thread Monitor */}
      <Tabs.Content value="cprograms" className="flex flex-1 flex-col overflow-hidden p-4 gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-panel)] px-3 py-2 text-xs">
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-[var(--accent-cyan)]" />
            <input
              type="text"
              value={cFilename}
              onChange={(e) => setCFilename(e.target.value)}
              className="w-56 rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 font-mono-tabular text-xs"
            />
            <select
              value={selectedThread}
              onChange={(e) => setSelectedThread(Number(e.target.value))}
              className="rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 font-mono-tabular text-xs"
            >
              {[1, 2, 3, 4, 5, 6, 7].map((t) => (
                <option key={t} value={t}>
                  Thread {t}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                onLogMessage?.(`Saved C-program ${cFilename} (${cCode.length} bytes)`)
              }
              className="btn-workshop !min-h-7 !px-2.5 !text-xs"
            >
              <Save className="h-3.5 w-3.5" />
              Save
            </button>
            <button
              type="button"
              onClick={() =>
                onLogMessage?.(
                  `Compile & Execute requested for ${cFilename} on Thread ${selectedThread}`,
                )
              }
              className="btn-workshop !min-h-7 !px-2.5 !text-xs !bg-emerald-600 !text-white !border-transparent"
            >
              <Play className="h-3.5 w-3.5" />
              Compile &amp; Run T{selectedThread}
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-[var(--border-default)]">
          <CodeMirrorEditor
            value={cCode}
            onChange={setCCode}
            language="cpp"
            theme={theme}
          />
        </div>
      </Tabs.Content>
    </Tabs.Root>
  );
};

export default KflopConfigView;
