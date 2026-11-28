import React, { useEffect, useRef, useState } from 'react';
import { Box, Compass, Layers, Maximize2, Rotate3d } from 'lucide-react';
import type { IgmDocument, SourceRef } from '@kmxcnc/igm';
import {
  ThreeToolpathRenderer,
  tessellateIgm,
  type CameraPreset,
  type MachineBounds,
  type Vec3,
} from '@kmxcnc/viewer-3d';

export interface Viewer3DPanelProps {
  igm: IgmDocument | null;
  machineBounds: MachineBounds;
  toolPosition: Vec3;
  highlight: SourceRef | null;
  theme: 'dark' | 'light';
  rotary4thAxis: boolean;
  rotaryRadiusMm?: number;
  onToggleRotary?: () => void;
  onSelectSource?: (source: SourceRef | null) => void;
  onHoverSource?: (source: SourceRef | null) => void;
}

export const Viewer3DPanel: React.FC<Viewer3DPanelProps> = ({
  igm,
  machineBounds,
  toolPosition,
  highlight,
  theme,
  rotary4thAxis,
  rotaryRadiusMm = 25,
  onToggleRotary,
  onSelectSource,
  onHoverSource,
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<ThreeToolpathRenderer | null>(null);
  const [hoveredRef, setHoveredRef] = useState<SourceRef | null>(null);
  const [segmentCount, setSegmentCount] = useState(0);
  const [webglError, setWebglError] = useState<string | null>(null);

  const onSelectRef = useRef(onSelectSource);
  const onHoverRef = useRef(onHoverSource);
  onSelectRef.current = onSelectSource;
  onHoverRef.current = onHoverSource;

  // Mount ThreeToolpathRenderer once
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;

    let renderer: ThreeToolpathRenderer | null = null;
    try {
      renderer = new ThreeToolpathRenderer({ theme, antialias: true });
      renderer.mount(el);
      rendererRef.current = renderer;
      setWebglError(null);
    } catch (err) {
      setWebglError(err instanceof Error ? err.message : 'WebGL initialization failed');
      return;
    }

    const unsubSelect = renderer.onSelect((src) => {
      onSelectRef.current?.(src);
    });
    const unsubHover = renderer.onHover((src) => {
      setHoveredRef(src);
      onHoverRef.current?.(src);
    });

    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect && rect.width > 0 && rect.height > 0) {
        renderer?.resize(rect.width, rect.height);
      }
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      unsubSelect();
      unsubHover();
      renderer?.unmount();
      rendererRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Theme sync
  useEffect(() => {
    rendererRef.current?.setTheme(theme);
  }, [theme]);

  // Machine bounds sync
  useEffect(() => {
    rendererRef.current?.setMachineBounds(machineBounds);
  }, [machineBounds]);

  // Tessellate IGM -> RenderSceneData
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer || !igm) return;
    const sceneData = tessellateIgm(igm, {
      arcToleranceMm: 0.25,
      rotaryAxisA: rotary4thAxis
        ? { enabled: true, radiusMm: Math.max(1, rotaryRadiusMm) }
        : { enabled: false, radiusMm: rotaryRadiusMm },
    });
    renderer.setScene(sceneData);
    setSegmentCount(sceneData.totalSegments);
  }, [igm, rotary4thAxis, rotaryRadiusMm]);

  // Live tool position from DRO
  useEffect(() => {
    rendererRef.current?.setToolPosition(toolPosition);
  }, [toolPosition]);

  // Highlighted sourceRef (active execution line or selected line)
  useEffect(() => {
    rendererRef.current?.setHighlight(highlight);
  }, [highlight]);

  const applyPreset = (preset: CameraPreset) => {
    rendererRef.current?.setCameraPreset(preset);
  };

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[var(--bg-app)]">
      {/* Floating Toolbar */}
      <div className="pointer-events-none absolute left-2 right-2 top-2 z-10 flex flex-wrap items-center justify-between gap-2">
        <div className="pointer-events-auto flex items-center gap-1 rounded-md border border-[var(--border-default)] bg-[var(--bg-panel)]/90 p-1 shadow backdrop-blur-sm">
          {(['top', 'front', 'iso', 'fit'] as const).map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => applyPreset(preset)}
              className="rounded px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            >
              {preset === 'fit' ? (
                <span className="inline-flex items-center gap-1">
                  <Maximize2 className="h-3 w-3" /> Fit
                </span>
              ) : (
                preset
              )}
            </button>
          ))}
        </div>

        <div className="pointer-events-auto flex items-center gap-1.5">
          {onToggleRotary && (
            <button
              type="button"
              onClick={onToggleRotary}
              title="Toggle 4th-axis cylindrical rotary A projection"
              className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold backdrop-blur-sm transition ${
                rotary4thAxis
                  ? 'border-purple-400/60 bg-purple-500/20 text-purple-300'
                  : 'border-[var(--border-default)] bg-[var(--bg-panel)]/90 text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Rotate3d className="h-3.5 w-3.5" />
              4th Axis
            </button>
          )}
        </div>
      </div>

      {/* Canvas Container */}
      <div ref={hostRef} className="h-full w-full flex-1">
        {webglError && (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-xs text-[var(--text-secondary)]">
            <Box className="h-8 w-8 text-[var(--accent-amber)]" />
            <div className="font-semibold text-[var(--text-primary)]">3D Viewer unavailable</div>
            <div className="max-w-xs text-[var(--text-muted)]">{webglError}</div>
          </div>
        )}
      </div>

      {/* Bottom HUD Legend & Hover SourceRef */}
      <div className="pointer-events-none absolute bottom-2 left-2 right-2 z-10 flex items-center justify-between gap-2 text-[11px]">
        <div className="flex items-center gap-3 rounded border border-[var(--border-subtle)] bg-[var(--bg-panel)]/85 px-2.5 py-1 text-[var(--text-secondary)] backdrop-blur-sm">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-400" /> Rapid
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-cyan-400" /> Cut
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-400" /> Tool
          </span>
          <span className="hidden items-center gap-1 text-[var(--text-muted)] sm:inline-flex">
            <Layers className="h-3 w-3" /> {segmentCount.toLocaleString()} segs
          </span>
        </div>

        {hoveredRef && (
          <div className="flex items-center gap-1.5 rounded border border-[var(--accent-primary)]/50 bg-[var(--bg-panel)]/90 px-2.5 py-1 font-mono-tabular text-[var(--accent-primary)] backdrop-blur-sm">
            <Compass className="h-3 w-3" />
            {hoveredRef.kind === 'gcode'
              ? `G-Code Line ${hoveredRef.line}`
              : hoveredRef.kind === 'heidenhain'
                ? `Klartext Line ${hoveredRef.line}`
                : hoveredRef.kind === 'svg'
                  ? `SVG #${hoveredRef.elementId}`
                  : hoveredRef.kind === 'pdf'
                    ? `PDF p.${hoveredRef.page} #${hoveredRef.opIndex}`
                    : `DXF ${hoveredRef.handle}`}
          </div>
        )}
      </div>
    </div>
  );
};
