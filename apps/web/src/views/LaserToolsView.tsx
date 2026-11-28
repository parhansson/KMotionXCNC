import React, { useMemo, useState } from 'react';
import { AlertTriangle, Copy, Flame, Plus, Sparkles, Trash2 } from 'lucide-react';
import {
  calculateLaserPpi,
  DEFAULT_LASER_MATERIALS,
  DEFAULT_LASER_PPI_INPUT,
  formatM100PpiCommand,
  type LaserMaterialPreset,
  type LaserPpiInput,
} from '@kmxcnc/plugin-laser';

const STORAGE_KEY = 'kmxcnc:laser-materials:v1';

function loadMaterials(): LaserMaterialPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LaserMaterialPreset[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // Ignore storage errors
  }
  return [...DEFAULT_LASER_MATERIALS];
}

export interface LaserToolsViewProps {
  onSendMdi?: (command: string) => void;
  canSendMdi?: boolean;
}

export const LaserToolsView: React.FC<LaserToolsViewProps> = ({
  onSendMdi,
  canSendMdi = false,
}) => {
  const [input, setInput] = useState<LaserPpiInput>({ ...DEFAULT_LASER_PPI_INPUT });
  const [materials, setMaterials] = useState<LaserMaterialPreset[]>(loadMaterials);
  const [newName, setNewName] = useState('');
  const [newThickness, setNewThickness] = useState(3);
  const [newPasses, setNewPasses] = useState(1);
  const [copied, setCopied] = useState(false);

  const result = useMemo(() => calculateLaserPpi(input), [input]);
  const m100Cmd = useMemo(
    () => formatM100PpiCommand(input.ppi, input.powerPercent),
    [input.ppi, input.powerPercent],
  );

  const persistMaterials = (next: LaserMaterialPreset[]) => {
    setMaterials(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const handleAddPreset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const preset: LaserMaterialPreset = {
      id: `custom-${Date.now()}`,
      name: newName.trim(),
      ppiMcode: m100Cmd,
      feedRate: input.feedRateMmPerMin,
      passes: Math.max(1, Math.round(newPasses)),
      thicknessMm: Math.max(0, newThickness),
    };
    persistMaterials([preset, ...materials]);
    setNewName('');
  };

  const handleApplyPreset = (preset: LaserMaterialPreset) => {
    const pMatch = preset.ppiMcode.match(/P(\d+)/i);
    const qMatch = preset.ppiMcode.match(/Q(\d+)/i);
    setInput((prev) => ({
      ...prev,
      ppi: pMatch ? Number(pMatch[1]) : prev.ppi,
      powerPercent: qMatch ? Number(qMatch[1]) : prev.powerPercent,
      feedRateMmPerMin: preset.feedRate,
    }));
  };

  const handleCopyCmd = () => {
    navigator.clipboard?.writeText(m100Cmd).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="grid h-full grid-cols-1 gap-4 overflow-y-auto p-4 lg:grid-cols-12">
      {/* Left: Interactive PPI Calculator */}
      <section className="flex flex-col gap-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-panel)] p-4 lg:col-span-5">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-[var(--accent-primary)]" />
            <div>
              <h2 className="text-sm font-bold text-[var(--text-primary)]">Laser PPI Calculator</h2>
              <p className="text-xs text-[var(--text-muted)]">
                Pulses per inch timing, duty cycle &amp; cut energy density
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {(
            [
              { key: 'ppi', label: 'PPI (pulses/in)', step: 50, min: 10, max: 5000 },
              { key: 'pulseWidthMs', label: 'Pulse Width (ms)', step: 0.1, min: 0.1, max: 20 },
              { key: 'feedRateMmPerMin', label: 'Feed Rate (mm/min)', step: 10, min: 10, max: 6000 },
              { key: 'powerPercent', label: 'Power (%)', step: 5, min: 1, max: 100 },
              { key: 'laserWattage', label: 'Laser Tube (W)', step: 5, min: 1, max: 500 },
              { key: 'beamDiameterMm', label: 'Spot / Kerf (mm)', step: 0.05, min: 0.05, max: 2 },
            ] as const
          ).map((field) => (
            <label key={field.key} className="flex flex-col gap-1 text-xs">
              <span className="font-semibold text-[var(--text-secondary)]">{field.label}</span>
              <input
                type="number"
                step={field.step}
                min={field.min}
                max={field.max}
                value={input[field.key] ?? 0}
                onChange={(e) =>
                  setInput((prev) => ({ ...prev, [field.key]: Number(e.target.value) }))
                }
                className="rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2.5 py-1.5 font-mono-tabular text-xs text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
              />
            </label>
          ))}
        </div>

        {/* Warning if over duty cycle */}
        {result.overDutyCycle && (
          <div className="flex items-center gap-2 rounded-md border border-amber-500/50 bg-amber-500/15 px-3 py-2 text-xs text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              Duty cycle exceeds 100% ({result.dutyCyclePercent.toFixed(1)}%) — pulses overlap into
              continuous wave!
            </span>
          </div>
        )}

        {/* Calculated Readouts */}
        <div className="grid grid-cols-2 gap-2 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 font-mono-tabular text-xs">
          <div>
            <div className="text-[10px] uppercase text-[var(--text-muted)]">Pulses / mm</div>
            <div className="text-base font-bold text-[var(--accent-cyan)]">
              {result.pulsesPerMm.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-[var(--text-muted)]">Frequency</div>
            <div className="text-base font-bold text-[var(--text-primary)]">
              {result.pulsesPerSec.toFixed(1)} Hz
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-[var(--text-muted)]">Pulse Period</div>
            <div className="text-sm font-bold text-[var(--text-primary)]">
              {Number.isFinite(result.pulsePeriodMs) ? `${result.pulsePeriodMs.toFixed(2)} ms` : '∞'}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-[var(--text-muted)]">Duty Cycle</div>
            <div
              className={`text-sm font-bold ${
                result.overDutyCycle ? 'text-amber-400' : 'text-emerald-400'
              }`}
            >
              {result.dutyCyclePercent.toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-[var(--text-muted)]">Energy / Pulse</div>
            <div className="text-sm font-bold text-[var(--text-primary)]">
              {result.energyPerPulseMj.toFixed(1)} mJ
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-[var(--text-muted)]">Energy Density</div>
            <div className="text-sm font-bold text-[var(--accent-amber)]">
              {result.energyDensityJPerCm2.toFixed(1)} J/cm²
            </div>
          </div>
          <div className="col-span-2 border-t border-[var(--border-subtle)] pt-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase text-[var(--text-muted)]">
                Delivered Power
              </span>
              <span className="text-sm font-bold text-emerald-400">
                {result.deliveredPowerW.toFixed(2)} W
              </span>
            </div>
          </div>
        </div>

        {/* M100 Command Box */}
        <div className="flex items-center justify-between gap-2 rounded-md border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2">
          <code className="font-mono-tabular text-sm font-bold text-[var(--accent-primary)]">
            {m100Cmd}
          </code>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={handleCopyCmd} className="btn-workshop !min-h-7 !px-2 !text-xs">
              <Copy className="h-3.5 w-3.5" />
              {copied ? 'Copied' : 'Copy'}
            </button>
            {onSendMdi && (
              <button
                type="button"
                disabled={!canSendMdi}
                onClick={() => onSendMdi(m100Cmd)}
                className="btn-workshop !min-h-7 !px-2.5 !text-xs !bg-[var(--accent-primary)] !text-slate-950 !border-transparent"
              >
                Send MDI
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Right: Material Presets Manager */}
      <section className="flex flex-col gap-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-panel)] p-4 lg:col-span-7">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[var(--accent-cyan)]" />
            <div>
              <h2 className="text-sm font-bold text-[var(--text-primary)]">Material Presets</h2>
              <p className="text-xs text-[var(--text-muted)]">
                Click any preset to load its PPI &amp; feed rate into the calculator
              </p>
            </div>
          </div>
        </div>

        {/* Add Preset Form */}
        <form onSubmit={handleAddPreset} className="grid grid-cols-1 gap-2 sm:grid-cols-12">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New preset name (e.g. Cut 3mm birch)"
            className="rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] sm:col-span-6 focus:border-[var(--accent-primary)] focus:outline-none"
          />
          <input
            type="number"
            step={0.5}
            min={0}
            value={newThickness}
            onChange={(e) => setNewThickness(Number(e.target.value))}
            title="Thickness (mm)"
            placeholder="mm"
            className="rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1.5 font-mono-tabular text-xs text-[var(--text-primary)] sm:col-span-2"
          />
          <input
            type="number"
            min={1}
            value={newPasses}
            onChange={(e) => setNewPasses(Number(e.target.value))}
            title="Passes"
            placeholder="Passes"
            className="rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1.5 font-mono-tabular text-xs text-[var(--text-primary)] sm:col-span-2"
          />
          <button
            type="submit"
            className="btn-workshop sm:col-span-2 !bg-emerald-600 !text-white !border-transparent"
          >
            <Plus className="h-3.5 w-3.5" />
            Save
          </button>
        </form>

        {/* Presets Table */}
        <div className="flex-1 overflow-x-auto rounded border border-[var(--border-subtle)]">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[11px] uppercase text-[var(--text-muted)]">
              <tr>
                <th className="px-3 py-2">Material</th>
                <th className="px-3 py-2">M-Code</th>
                <th className="px-3 py-2">Feed</th>
                <th className="px-3 py-2">Passes</th>
                <th className="px-3 py-2">Thick</th>
                <th className="px-2 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {materials.map((m) => (
                <tr
                  key={m.id}
                  onClick={() => handleApplyPreset(m)}
                  className="cursor-pointer transition hover:bg-[var(--bg-hover)]"
                >
                  <td className="px-3 py-2 font-semibold text-[var(--text-primary)]">
                    {m.name}
                    {m.notes && (
                      <div className="text-[10px] font-normal text-[var(--text-muted)]">
                        {m.notes}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono-tabular text-[var(--accent-primary)]">
                    {m.ppiMcode}
                  </td>
                  <td className="px-3 py-2 font-mono-tabular">{m.feedRate} mm/m</td>
                  <td className="px-3 py-2 font-mono-tabular">{m.passes}</td>
                  <td className="px-3 py-2 font-mono-tabular">{m.thicknessMm} mm</td>
                  <td className="px-2 py-2 text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        persistMaterials(materials.filter((x) => x.id !== m.id));
                      }}
                      title="Delete preset"
                      className="rounded p-1 text-[var(--text-muted)] hover:bg-red-500/20 hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default LaserToolsView;
