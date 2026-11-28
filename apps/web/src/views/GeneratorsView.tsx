import React, { useMemo, useState } from 'react';
import { Download, Send, Sparkles } from 'lucide-react';
import { getDefaultParams, type ParamField, type PluginGenerator } from '@kmxcnc/plugin-sdk';
import { generatorsPlugin } from '@kmxcnc/plugin-generators';
import { MillPostProcessor, optimizeIgm, parseSvgToIgm } from '@kmxcnc/cam-engine';
import { laserPostProcessor } from '@kmxcnc/plugin-laser';

const millPost = new MillPostProcessor();

export interface GeneratorsViewProps {
  onLoadGcode: (filename: string, gcode: string) => void;
}

export const GeneratorsView: React.FC<GeneratorsViewProps> = ({ onLoadGcode }) => {
  const generators: PluginGenerator[] = generatorsPlugin.generators ?? [];
  const [selectedId, setSelectedId] = useState<string>(generators[0]?.id ?? '');
  const [postMode, setPostMode] = useState<'mill' | 'laser'>('laser');
  const [feedRate, setFeedRate] = useState(400);
  const [cutZ, setCutZ] = useState(-1);

  const [paramsByGen, setParamsByGen] = useState<
    Record<string, Record<string, number | string | boolean>>
  >(() => {
    const map: Record<string, Record<string, number | string | boolean>> = {};
    for (const g of generators) {
      map[g.id] = getDefaultParams(g.params);
    }
    return map;
  });

  const activeGen = generators.find((g) => g.id === selectedId) ?? generators[0];
  const activeParams = (activeGen ? paramsByGen[activeGen.id] : undefined) ?? {};

  const [genError, setGenError] = useState<string | null>(null);

  const generated = useMemo(() => {
    if (!activeGen) return null;
    try {
      setGenError(null);
      const res = activeGen.generate(activeParams);
      if (res instanceof Promise) return null;
      return res;
    } catch (err) {
      setGenError(err instanceof Error ? err.message : String(err));
      return null;
    }
  }, [activeGen, activeParams]);

  const updateField = (field: ParamField, value: number | string | boolean) => {
    if (!activeGen) return;
    setParamsByGen((prev) => ({
      ...prev,
      [activeGen.id]: {
        ...(prev[activeGen.id] ?? {}),
        [field.name]: value,
      },
    }));
  };

  const handleConvertAndLoad = () => {
    if (!activeGen || !generated?.svg) return;
    const igm = generated.igm ?? parseSvgToIgm(generated.svg);
    const opt = optimizeIgm(igm, {
      translateToOrigin: true,
      removeSingularities: true,
      shortestPath: true,
    });
    const gcode =
      postMode === 'laser'
        ? laserPostProcessor.generate(opt, { feedRate, ppiMcode: 'M100 P1000 Q100' })
        : millPost.generate(opt, { feedRate, safeZ: 5, cutZ });
    const baseName = (generated.suggestedFilename ?? `${activeGen.id}.svg`).replace(/\.svg$/i, '');
    onLoadGcode(`${baseName}.ngc`, gcode);
  };

  const handleDownloadSvg = () => {
    if (!activeGen || !generated?.svg) return;
    const blob = new Blob([generated.svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = generated.suggestedFilename ?? `${activeGen.id}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!activeGen) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">
        No parametric generators registered.
      </div>
    );
  }

  const sortedFields = [...activeGen.params].sort((a, b) => (a.order ?? 100) - (b.order ?? 100));

  return (
    <div className="grid h-full grid-cols-1 gap-4 overflow-y-auto p-4 lg:grid-cols-12">
      {/* Left: Generator Selector + Dynamic ParamField Form */}
      <div className="flex flex-col gap-3 overflow-y-auto lg:col-span-4">
        <div className="flex flex-wrap gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-panel)] p-2.5">
          {generators.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setSelectedId(g.id)}
              className={`rounded-md px-2.5 py-1.5 text-xs font-bold transition ${
                g.id === activeGen.id
                  ? 'bg-[var(--accent-primary)] text-slate-950'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>

        <section className="space-y-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-panel)] p-4">
          <div className="border-b border-[var(--border-subtle)] pb-2">
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-[var(--text-primary)]">
              <Sparkles className="h-4 w-4 text-[var(--accent-primary)]" />
              {activeGen.name}
            </h2>
            {activeGen.description && (
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">{activeGen.description}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2.5 text-xs">
            {sortedFields.map((field) => {
              const val = activeParams[field.name] ?? field.defaultValue;
              if (field.type === 'boolean') {
                return (
                  <label
                    key={field.name}
                    className="col-span-2 flex cursor-pointer items-center justify-between rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5"
                  >
                    <span className="font-semibold text-[var(--text-secondary)]">
                      {field.label}
                    </span>
                    <input
                      type="checkbox"
                      checked={Boolean(val)}
                      onChange={(e) => updateField(field, e.target.checked)}
                      className="accent-amber-500"
                    />
                  </label>
                );
              }
              if (field.type === 'select' && field.options) {
                return (
                  <label key={field.name} className="col-span-2 flex flex-col gap-1">
                    <span className="font-semibold text-[var(--text-secondary)]">
                      {field.label}
                    </span>
                    <select
                      value={String(val)}
                      onChange={(e) => updateField(field, e.target.value)}
                      className="rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1.5 text-xs text-[var(--text-primary)]"
                    >
                      {field.options.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              }
              if (field.type === 'textarea') {
                return (
                  <label key={field.name} className="col-span-2 flex flex-col gap-1">
                    <span className="font-semibold text-[var(--text-secondary)]">
                      {field.label}
                    </span>
                    <textarea
                      rows={2}
                      value={String(val)}
                      onChange={(e) => updateField(field, e.target.value)}
                      className="rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1.5 font-mono-tabular text-xs"
                    />
                  </label>
                );
              }
              return (
                <label
                  key={field.name}
                  className={`flex flex-col gap-1 ${field.type === 'string' ? 'col-span-2' : ''}`}
                >
                  <span className="font-semibold text-[var(--text-secondary)]">
                    {field.label}
                    {field.unit ? ` (${field.unit})` : ''}
                  </span>
                  <input
                    type={field.type === 'number' ? 'number' : 'text'}
                    min={field.min}
                    max={field.max}
                    step={field.step ?? (field.type === 'number' ? 'any' : undefined)}
                    value={String(val)}
                    onChange={(e) =>
                      updateField(
                        field,
                        field.type === 'number' ? Number(e.target.value) : e.target.value,
                      )
                    }
                    className="rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1.5 font-mono-tabular text-xs text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                  />
                </label>
              );
            })}
          </div>

          {/* Export / Convert Options */}
          <div className="space-y-2 border-t border-[var(--border-subtle)] pt-3 text-xs">
            <div className="grid grid-cols-3 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-[var(--text-secondary)]">Post</span>
                <select
                  value={postMode}
                  onChange={(e) => setPostMode(e.target.value as 'mill' | 'laser')}
                  className="rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-1.5 py-1 text-xs"
                >
                  <option value="laser">Laser</option>
                  <option value="mill">Mill</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-[var(--text-secondary)]">Feed</span>
                <input
                  type="number"
                  value={feedRate}
                  onChange={(e) => setFeedRate(Number(e.target.value))}
                  className="rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-1.5 py-1 font-mono-tabular text-xs"
                />
              </label>
              {postMode === 'mill' && (
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-[var(--text-secondary)]">Cut Z</span>
                  <input
                    type="number"
                    step={0.5}
                    value={cutZ}
                    onChange={(e) => setCutZ(Number(e.target.value))}
                    className="rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-1.5 py-1 font-mono-tabular text-xs"
                  />
                </label>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={!generated?.svg}
                onClick={handleConvertAndLoad}
                className="btn-workshop flex-1 !bg-emerald-600 !text-white !border-transparent hover:!bg-emerald-500"
              >
                <Send className="h-3.5 w-3.5" />
                Convert to G-Code &amp; Load
              </button>
              <button
                type="button"
                disabled={!generated?.svg}
                onClick={handleDownloadSvg}
                title="Download SVG"
                className="btn-workshop !px-2.5"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Right: Live SVG Preview */}
      <div className="flex min-h-[400px] flex-col rounded-lg border border-[var(--border-default)] bg-[var(--bg-panel)] p-4 lg:col-span-8">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-bold text-[var(--text-primary)]">Live SVG Preview</span>
          {generated?.suggestedFilename && (
            <span className="font-mono-tabular text-[11px] text-[var(--text-muted)]">
              {generated.suggestedFilename}
            </span>
          )}
        </div>

        {genError ? (
          <div className="flex flex-1 items-center justify-center text-xs text-red-400">
            {genError}
          </div>
        ) : generated?.svg ? (
          <div
            className="flex flex-1 items-center justify-center overflow-auto rounded-md border border-[var(--border-subtle)] bg-white p-4 [&>svg]:max-h-[68vh] [&>svg]:max-w-full [&>svg]:w-auto [&>svg]:h-auto"
            dangerouslySetInnerHTML={{ __html: generated.svg }}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center text-xs text-[var(--text-muted)]">
            Generating preview…
          </div>
        )}
      </div>
    </div>
  );
};

export default GeneratorsView;
