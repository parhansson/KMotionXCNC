import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Box,
  CheckSquare,
  Code2,
  FileType,
  FileUp,
  Layers,
  Loader2,
  Send,
  SlidersHorizontal,
  Sparkles,
  Square,
} from 'lucide-react';
import {
  evaluateHeidenhainToIgm,
  optimizeIgm,
  parseDxfToIgm,
  parseGcodeToIgm,
  parseHeidenhainToAst,
  parsePdfToIgm,
  parseSvgToIgm,
  transpileHeidenhainToGcode,
  MillPostProcessor,
} from '@kmxcnc/cam-engine';
import { analyzePreflight, type IgmDocument, type StockBounds } from '@kmxcnc/igm';
import { laserPostProcessor } from '@kmxcnc/plugin-laser';
import { Viewer3DPanel } from '../components/cnc/Viewer3DPanel';
import { useCncRuntime } from '../context/CncContext';
import type { MachineBounds } from '@kmxcnc/viewer-3d';

const SAMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80" width="120mm" height="80mm">
  <g id="outer-frame">
    <rect x="10" y="10" width="100" height="60" rx="6" fill="none" stroke="#000"/>
  </g>
  <g id="mounting-holes">
    <circle cx="22" cy="22" r="3" fill="none" stroke="#000"/>
    <circle cx="98" cy="22" r="3" fill="none" stroke="#000"/>
    <circle cx="22" cy="58" r="3" fill="none" stroke="#000"/>
    <circle cx="98" cy="58" r="3" fill="none" stroke="#000"/>
  </g>
  <g id="center-pocket">
    <circle cx="60" cy="40" r="16" fill="none" stroke="#000"/>
  </g>
</svg>`;

const millPost = new MillPostProcessor();

export interface ImportCamViewProps {
  theme: 'dark' | 'light';
  machineBounds: MachineBounds;
  onSendGcodeToController: (filename: string, gcode: string) => void;
}

const GCODE_EXTENSIONS = new Set(['nc', 'ngc', 'gcode', 'gco', 'tap', 'cnc', 'txt']);

export const ImportCamView: React.FC<ImportCamViewProps> = ({
  theme,
  machineBounds,
  onSendGcodeToController,
}) => {
  const { controller } = useCncRuntime();
  const [sourceName, setSourceName] = useState('sample-bracket.svg');
  const [sourceFormat, setSourceFormat] = useState<'svg' | 'dxf' | 'gcode' | 'pdf' | 'heidenhain'>('svg');
  const [rawText, setRawText] = useState(SAMPLE_SVG);
  const [heidenhainMode, setHeidenhainMode] = useState<'structured' | 'flattened'>('structured');
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null);
  const [pdfPage, setPdfPage] = useState(1);
  const [pdfPageCount, setPdfPageCount] = useState(1);
  const [pdfRotation, setPdfRotation] = useState<0 | 90 | 180 | 270>(0);
  const [pdfIncludeText, setPdfIncludeText] = useState(true);
  const [pdfFontBuffer, setPdfFontBuffer] = useState<ArrayBuffer | null>(null);
  const [pdfFontName, setPdfFontName] = useState<string | null>(null);
  const [pdfIgm, setPdfIgm] = useState<IgmDocument | null>(null);
  const [pdfWarnings, setPdfWarnings] = useState<string[]>([]);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [dragging, setDragging] = useState(false);

  // Layer visibility overrides
  const [hiddenLayers, setHiddenLayers] = useState<Record<string, boolean>>({});

  // CAM Options
  const [scale, setScale] = useState(1);
  const [translateToOrigin, setTranslateToOrigin] = useState(true);
  const [joinAdjacent, setJoinAdjacent] = useState(true);
  const [shortestPath, setShortestPath] = useState(true);
  const [postId, setPostId] = useState<'mill' | 'laser'>('mill');
  const [feedRate, setFeedRate] = useState(600);
  const [safeZ, setSafeZ] = useState(5);
  const [cutZ, setCutZ] = useState(-1.5);
  const [passCount, setPassCount] = useState(1);
  const [ppiMcode, setPpiMcode] = useState('M100 P1000 Q100');

  const [parseError, setParseError] = useState<string | null>(null);

  // Async PDF -> IGM opcode conversion (lazy-loads pdfjs-dist + opentype.js only when needed)
  useEffect(() => {
    if (sourceFormat !== 'pdf' || !pdfBytes) {
      setPdfIgm(null);
      setPdfWarnings([]);
      return;
    }

    let cancelled = false;
    setPdfLoading(true);
    setParseError(null);

    const loadMachineFont = async (): Promise<ArrayBuffer | null> => {
      try {
        const storage = controller.getStorage();
        const listing = await storage.listDir('settings/fonts');
        const fontFile = listing.files.find(
          (f) => !f.isDirectory && /\.(ttf|otf)$/i.test(f.name),
        );
        if (!fontFile) return null;
        return await storage.readBinary(`settings/fonts/${fontFile.name}`);
      } catch {
        return null;
      }
    };

    let cachedMachineFont: Promise<ArrayBuffer | null> | null = null;

    void parsePdfToIgm(pdfBytes, {
      pageNumber: pdfPage,
      rotation: pdfRotation,
      includeText: pdfIncludeText,
      textLayerVisible: true,
      fallbackFontBuffer: pdfFontBuffer,
      loadFont: pdfFontBuffer
        ? undefined
        : () => {
            if (!cachedMachineFont) {
              cachedMachineFont = loadMachineFont();
            }
            return cachedMachineFont;
          },
    })
      .then((res) => {
        if (cancelled) return;
        setPdfIgm(res.doc);
        setPdfPageCount(res.pageCount);
        setPdfWarnings(res.warnings);
      })
      .catch((err) => {
        if (cancelled) return;
        setPdfIgm(null);
        setParseError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setPdfLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [controller, sourceFormat, pdfBytes, pdfPage, pdfRotation, pdfIncludeText, pdfFontBuffer]);

  const heidenhainPipeline = useMemo(() => {
    if (sourceFormat !== 'heidenhain') return null;
    try {
      const ast = parseHeidenhainToAst(rawText);
      const evalResult = evaluateHeidenhainToIgm(ast);
      const transpileResult = transpileHeidenhainToGcode(ast, { mode: heidenhainMode });
      return { ast, evalResult, transpileResult, error: null as string | null };
    } catch (err) {
      return {
        ast: null,
        evalResult: null,
        transpileResult: null,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }, [rawText, sourceFormat, heidenhainMode]);

  useEffect(() => {
    if (sourceFormat === 'heidenhain') {
      setParseError(heidenhainPipeline?.error ?? null);
    }
  }, [sourceFormat, heidenhainPipeline]);

  const parsedIgm = useMemo<IgmDocument | null>(() => {
    if (sourceFormat === 'pdf') return pdfIgm;
    if (sourceFormat === 'heidenhain') return heidenhainPipeline?.evalResult?.document ?? null;
    try {
      setParseError(null);
      if (sourceFormat === 'svg') return parseSvgToIgm(rawText);
      if (sourceFormat === 'dxf') return parseDxfToIgm(rawText);
      return parseGcodeToIgm(rawText);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : String(err));
      return null;
    }
  }, [rawText, sourceFormat, pdfIgm, heidenhainPipeline]);

  const optimizedIgm = useMemo<IgmDocument | null>(() => {
    if (!parsedIgm) return null;
    const withVisibility: IgmDocument = {
      ...parsedIgm,
      layers: parsedIgm.layers.map((l) => ({
        ...l,
        visible: !hiddenLayers[l.id],
      })),
    };
    if (sourceFormat === 'heidenhain') {
      return {
        ...withVisibility,
        layers: withVisibility.layers.filter((l) => l.visible),
      };
    }
    return optimizeIgm(withVisibility, {
      filterVisibleLayers: true,
      scale,
      translateToOrigin,
      removeSingularities: true,
      joinAdjacent,
      shortestPath,
    });
  }, [parsedIgm, sourceFormat, hiddenLayers, scale, translateToOrigin, joinAdjacent, shortestPath]);

  const generatedGcode = useMemo(() => {
    if (sourceFormat === 'heidenhain') {
      return heidenhainPipeline?.transpileResult?.gcode ?? '';
    }
    if (!optimizedIgm) return '';
    if (postId === 'laser') {
      return laserPostProcessor.generate(optimizedIgm, {
        feedRate,
        ppiMcode,
        passes: passCount,
        cutZ: 0,
      });
    }
    return millPost.generate(optimizedIgm, {
      feedRate,
      safeZ,
      cutZ,
      passCount,
      materialThickness: passCount > 1 ? Math.abs(cutZ) : undefined,
    });
  }, [sourceFormat, heidenhainPipeline, optimizedIgm, postId, feedRate, safeZ, cutZ, passCount, ppiMcode]);

  const previewIgm = useMemo(() => {
    if (sourceFormat === 'heidenhain') return optimizedIgm;
    if (!generatedGcode) return optimizedIgm;
    return parseGcodeToIgm(generatedGcode);
  }, [sourceFormat, generatedGcode, optimizedIgm]);

  const preflight = useMemo(() => {
    if (!previewIgm) return null;
    return analyzePreflight(previewIgm, {
      dimX: machineBounds.maxX - machineBounds.minX,
      dimY: machineBounds.maxY - machineBounds.minY,
      dimZ: machineBounds.maxZ - machineBounds.minZ,
    });
  }, [previewIgm, machineBounds]);

  const loadFile = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    setParseError(null);

    if (ext === 'pdf') {
      const buf = await file.arrayBuffer();
      setSourceName(file.name);
      setHiddenLayers({});
      setPdfPage(1);
      setPdfPageCount(1);
      setPdfBytes(buf);
      setSourceFormat('pdf');
      return;
    }

    if (ext === 'h') {
      const text = await file.text();
      setSourceName(file.name);
      setHiddenLayers({});
      setPdfBytes(null);
      setSourceFormat('heidenhain');
      setRawText(text);
      return;
    }

    if (ext === 'svg' || ext === 'dxf' || GCODE_EXTENSIONS.has(ext)) {
      const text = await file.text();
      setSourceName(file.name);
      setHiddenLayers({});
      setPdfBytes(null);
      setSourceFormat(ext === 'svg' ? 'svg' : ext === 'dxf' ? 'dxf' : 'gcode');
      setRawText(text);
      return;
    }

    setParseError(
      `Unsupported file type ".${ext || 'unknown'}". Supported formats: SVG, DXF, PDF, Heidenhain (.h), and G-Code (.nc/.ngc/.gcode/.tap).`,
    );
  };

  const loadFallbackFont = async (file: File) => {
    const buf = await file.arrayBuffer();
    setPdfFontBuffer(buf);
    setPdfFontName(file.name);
  };

  const handleSend = () => {
    if (!generatedGcode) return;
    const base = sourceName.replace(/\.[^.]+$/, '');
    onSendGcodeToController(`${base}.ngc`, generatedGcode);
  };

  return (
    <div className="grid h-full grid-cols-1 gap-4 overflow-y-auto p-4 lg:grid-cols-12">
      {/* Left Sidebar: Dropzone, Layers, CAM Params */}
      <div className="flex flex-col gap-3 overflow-y-auto lg:col-span-4">
        {/* File Dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files[0];
            if (f) void loadFile(f);
          }}
          className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 text-center transition ${
            dragging
              ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
              : 'border-[var(--border-default)] bg-[var(--bg-panel)]'
          }`}
        >
          <FileUp className="h-6 w-6 text-[var(--accent-primary)]" />
          <div className="text-xs font-bold text-[var(--text-primary)]">
            Drop SVG, DXF, PDF, Heidenhain (.h), or G-Code file
          </div>
          <div className="font-mono-tabular text-[11px] text-[var(--text-muted)]">
            Loaded: {sourceName} ({sourceFormat.toUpperCase()})
          </div>
          <label className="btn-workshop !min-h-7 !px-3 !text-xs cursor-pointer">
            Browse File
            <input
              type="file"
              accept=".svg,.dxf,.pdf,.h,.nc,.ngc,.gcode,.gco,.tap,.cnc,.txt"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void loadFile(f);
              }}
            />
          </label>
          {pdfLoading && (
            <div className="flex items-center gap-1.5 text-xs text-[var(--accent-cyan)]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Parsing PDF opcodes…
            </div>
          )}
          {parseError && <div className="text-xs text-red-400">{parseError}</div>}
        </div>

        {/* PDF Import Options */}
        {sourceFormat === 'pdf' && (
          <section className="space-y-2.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-panel)] p-3 text-xs">
            <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              <FileType className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
              PDF Options
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-[var(--text-secondary)]">
                  Page (1–{pdfPageCount})
                </span>
                <input
                  type="number"
                  min={1}
                  max={pdfPageCount}
                  value={pdfPage}
                  onChange={(e) =>
                    setPdfPage(Math.max(1, Math.min(pdfPageCount, Number(e.target.value) || 1)))
                  }
                  className="rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 font-mono-tabular"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-[var(--text-secondary)]">Rotation</span>
                <select
                  value={pdfRotation}
                  onChange={(e) => setPdfRotation(Number(e.target.value) as 0 | 90 | 180 | 270)}
                  className="rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-xs text-[var(--text-primary)]"
                >
                  <option value={0}>0°</option>
                  <option value={90}>90°</option>
                  <option value={180}>180°</option>
                  <option value={270}>270°</option>
                </select>
              </label>
            </div>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={pdfIncludeText}
                onChange={(e) => setPdfIncludeText(e.target.checked)}
              />
              <span>Extract PDF Text into separate layer</span>
            </label>

            {pdfIncludeText && (
              <div className="flex items-center justify-between gap-2 pt-0.5">
                <span className="truncate text-[11px] text-[var(--text-muted)]">
                  Fallback font: {pdfFontName ?? 'Embedded / Machine / Stroke'}
                </span>
                <label className="btn-workshop !min-h-6 !px-2 !text-[11px] cursor-pointer shrink-0">
                  Load .ttf/.otf
                  <input
                    type="file"
                    accept=".ttf,.otf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void loadFallbackFont(f);
                    }}
                  />
                </label>
              </div>
            )}

            {pdfWarnings.map((w, idx) => (
              <div key={idx} className="flex items-start gap-1.5 text-[11px] text-amber-300">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{w}</span>
              </div>
            ))}
          </section>
        )}

        {/* Layers */}
        {parsedIgm && (
          <section className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-panel)] p-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              <Layers className="h-3.5 w-3.5 text-[var(--accent-cyan)]" />
              IGM Layers ({parsedIgm.layers.length})
            </div>
            <div className="space-y-1">
              {parsedIgm.layers.map((layer) => {
                const visible = !hiddenLayers[layer.id];
                return (
                  <button
                    key={layer.id}
                    type="button"
                    onClick={() =>
                      setHiddenLayers((prev) => ({ ...prev, [layer.id]: visible }))
                    }
                    className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs hover:bg-[var(--bg-hover)]"
                  >
                    <span className="flex items-center gap-2">
                      {visible ? (
                        <CheckSquare className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <Square className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                      )}
                      <span className={visible ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)] line-through'}>
                        {layer.name || layer.id}
                      </span>
                    </span>
                    <span className="font-mono-tabular text-[11px] text-[var(--text-muted)]">
                      {layer.segments.length} segs
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Heidenhain Klartext Options */}
        {sourceFormat === 'heidenhain' && (
          <section className="space-y-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-panel)] p-3 text-xs">
            <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              <Code2 className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
              Heidenhain Klartext Options
            </div>

            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-[var(--text-secondary)]">
                G-Code Output Mode
              </span>
              <select
                value={heidenhainMode}
                onChange={(e) =>
                  setHeidenhainMode(e.target.value as 'structured' | 'flattened')
                }
                className="rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1.5 text-xs text-[var(--text-primary)]"
              >
                <option value="structured">
                  Structured KMotionX (M98/O/#/G81–G83)
                </option>
                <option value="flattened">Flattened via IGM</option>
              </select>
            </label>

            {heidenhainPipeline?.transpileResult?.fellBack && (
              <div className="flex items-start gap-1.5 rounded border border-amber-500/40 bg-amber-500/10 p-2 text-[11px] text-amber-200">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                <span>
                  Structured mode auto-fell back to <strong>Flattened via IGM</strong> for
                  unsupported KMotionX RS274 constructs.
                </span>
              </div>
            )}

            {(() => {
              const sb =
                heidenhainPipeline?.evalResult?.stockBounds ??
                (parsedIgm?.metadata?.stockBounds as StockBounds | undefined);
              if (!sb) return null;
              const dx = sb.max.x - sb.min.x;
              const dy = sb.max.y - sb.min.y;
              const dz = sb.max.z - sb.min.z;
              return (
                <div className="space-y-1 rounded border border-[var(--border-default)] bg-[var(--bg-input)]/60 p-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-secondary)]">
                    <Box className="h-3.5 w-3.5 text-[var(--accent-cyan)]" />
                    BLK FORM Stock Dimensions (mm)
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 font-mono-tabular text-[11px] text-[var(--text-primary)]">
                    <div>
                      <span className="text-[var(--text-muted)]">X: </span>
                      {dx.toFixed(1)}
                      <div className="text-[10px] text-[var(--text-muted)]">
                        [{sb.min.x.toFixed(1)}..{sb.max.x.toFixed(1)}]
                      </div>
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)]">Y: </span>
                      {dy.toFixed(1)}
                      <div className="text-[10px] text-[var(--text-muted)]">
                        [{sb.min.y.toFixed(1)}..{sb.max.y.toFixed(1)}]
                      </div>
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)]">Z: </span>
                      {dz.toFixed(1)}
                      <div className="text-[10px] text-[var(--text-muted)]">
                        [{sb.min.z.toFixed(1)}..{sb.max.z.toFixed(1)}]
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {(heidenhainPipeline?.transpileResult?.warnings.length ||
              heidenhainPipeline?.evalResult?.warnings.length) ? (
              <div className="space-y-1">
                {Array.from(
                  new Set([
                    ...(heidenhainPipeline?.transpileResult?.warnings ?? []),
                    ...(heidenhainPipeline?.evalResult?.warnings ?? []),
                  ]),
                ).map((w, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-1.5 text-[11px] text-amber-300"
                  >
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            ) : null}

            <button
              type="button"
              disabled={!generatedGcode}
              onClick={handleSend}
              className="btn-workshop w-full !min-h-9 !bg-emerald-600 !text-white !border-transparent hover:!bg-emerald-500"
            >
              <Send className="h-4 w-4" />
              Send G-Code to Controller
            </button>
          </section>
        )}

        {/* CAM & Postprocessor Options (hidden for Heidenhain Klartext which carries Z depths, feeds, and tool calls) */}
        {sourceFormat !== 'heidenhain' && (
          <section className="space-y-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-panel)] p-3 text-xs">
          <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[var(--text-secondary)]">
            <SlidersHorizontal className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
            CAM &amp; Postprocessor
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="col-span-2 flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-[var(--text-secondary)]">
                Postprocessor
              </span>
              <select
                value={postId}
                onChange={(e) => setPostId(e.target.value as 'mill' | 'laser')}
                className="rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1.5 text-xs text-[var(--text-primary)]"
              >
                <option value="mill">Mill / Router (3-Axis Z Plunge)</option>
                <option value="laser">Laser PPI (M100 + M3/M5)</option>
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-[var(--text-secondary)]">Scale</span>
              <input
                type="number"
                step={0.1}
                min={0.01}
                value={scale}
                onChange={(e) => setScale(Math.max(0.01, Number(e.target.value)))}
                className="rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 font-mono-tabular"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-[var(--text-secondary)]">Feed (mm/min)</span>
              <input
                type="number"
                step={50}
                min={1}
                value={feedRate}
                onChange={(e) => setFeedRate(Math.max(1, Number(e.target.value)))}
                className="rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 font-mono-tabular"
              />
            </label>

            {postId === 'mill' ? (
              <>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-[var(--text-secondary)]">Safe Z (mm)</span>
                  <input
                    type="number"
                    step={1}
                    value={safeZ}
                    onChange={(e) => setSafeZ(Number(e.target.value))}
                    className="rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 font-mono-tabular"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-[var(--text-secondary)]">Cut Z (mm)</span>
                  <input
                    type="number"
                    step={0.5}
                    value={cutZ}
                    onChange={(e) => setCutZ(Number(e.target.value))}
                    className="rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 font-mono-tabular"
                  />
                </label>
              </>
            ) : (
              <label className="col-span-2 flex flex-col gap-1">
                <span className="text-[11px] text-[var(--text-secondary)]">Laser PPI M-Code</span>
                <input
                  type="text"
                  value={ppiMcode}
                  onChange={(e) => setPpiMcode(e.target.value)}
                  className="rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 font-mono-tabular"
                />
              </label>
            )}

            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-[var(--text-secondary)]">Passes</span>
              <input
                type="number"
                min={1}
                max={20}
                value={passCount}
                onChange={(e) => setPassCount(Math.max(1, Math.round(Number(e.target.value))))}
                className="rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 font-mono-tabular"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-3 pt-1">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={translateToOrigin}
                onChange={(e) => setTranslateToOrigin(e.target.checked)}
                className="accent-amber-500"
              />
              <span>Origin (0,0)</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={joinAdjacent}
                onChange={(e) => setJoinAdjacent(e.target.checked)}
                className="accent-amber-500"
              />
              <span>Join Segments</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={shortestPath}
                onChange={(e) => setShortestPath(e.target.checked)}
                className="accent-amber-500"
              />
              <span>Shortest Path</span>
            </label>
          </div>

          <button
            type="button"
            disabled={!generatedGcode}
            onClick={handleSend}
            className="btn-workshop w-full !min-h-9 !bg-emerald-600 !text-white !border-transparent hover:!bg-emerald-500"
          >
            <Send className="h-4 w-4" />
            Send G-Code to Controller
          </button>
          </section>
        )}
      </div>

      {/* Right: Live 3D Toolpath Preview + Stats */}
      <div className="flex min-h-[420px] flex-col gap-3 lg:col-span-8">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-panel)] px-3 py-2 text-xs">
          <span className="flex items-center gap-1.5 font-bold text-[var(--text-primary)]">
            <Sparkles className="h-4 w-4 text-[var(--accent-cyan)]" />
            {sourceFormat === 'heidenhain'
              ? `Live CAM Preview (Heidenhain Klartext → ${
                  heidenhainPipeline?.transpileResult?.usedMode === 'structured'
                    ? 'Structured KMotionX'
                    : 'Flattened'
                } G-Code)`
              : `Live CAM Preview (IGM → ${postId === 'laser' ? 'Laser PPI' : 'Mill'} G-Code)`}
          </span>
          {preflight && (
            <div className="flex items-center gap-3 font-mono-tabular text-[11px] text-[var(--text-secondary)]">
              <span>Cut: {preflight.cutDistanceMm.toFixed(1)} mm</span>
              <span>Rapid: {preflight.rapidDistanceMm.toFixed(1)} mm</span>
              <span>Est: ~{Math.round(preflight.estimatedTimeSec)}s</span>
              <span className="text-[var(--accent-cyan)]">
                {generatedGcode.split('\n').length} lines
              </span>
            </div>
          )}
        </div>

        <div className="relative flex-1 overflow-hidden rounded-lg border border-[var(--border-default)]">
          <Viewer3DPanel
            igm={previewIgm}
            machineBounds={machineBounds}
            toolPosition={{ x: 0, y: 0, z: 0 }}
            highlight={null}
            theme={theme}
            rotary4thAxis={false}
          />
        </div>
      </div>
    </div>
  );
};

export default ImportCamView;
