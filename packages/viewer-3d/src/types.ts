import type { MoveKind, SourceRef } from '@kmxcnc/igm';

export type { MoveKind, SourceRef };

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface MachineBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export interface RenderLayerBuffer {
  layerId: string;
  kind: MoveKind;
  /** Packed line-segment vertex pairs: [x1, y1, z1, x2, y2, z2, ...] */
  positions: Float32Array;
  /** Number of line segments in this buffer (positions.length / 6) */
  segmentCount: number;
  /** Parallel index mapping segment index -> SourceRef (or null) */
  sourceRefs: (SourceRef | null)[];
}

export interface RenderSceneData {
  layers: RenderLayerBuffer[];
  bounds: { min: Vec3; max: Vec3 };
  totalSegments: number;
}

export type CameraPreset = 'top' | 'front' | 'iso' | 'fit';

export type ViewerTheme = 'dark' | 'light';

export interface RotaryAxisAOptions {
  enabled: boolean;
  radiusMm: number;
}

export interface TessellateOptions {
  /** Maximum chord error in mm when tessellating arcs and rotary moves (default: 0.25) */
  arcToleranceMm?: number;
  /** Optional 4th-axis cylindrical projection around the X axis */
  rotaryAxisA?: RotaryAxisAOptions;
}

export interface ToolpathRenderer {
  mount(container: HTMLElement): void;
  unmount(): void;
  resize(width: number, height: number): void;
  setScene(data: RenderSceneData): void;
  setMachineBounds(bounds: MachineBounds): void;
  setToolPosition(pos: Vec3): void;
  setHighlight(source: SourceRef | null): void;
  setCameraPreset(preset: CameraPreset): void;
  setTheme?(theme: ViewerTheme): void;
  onSelect(handler: (source: SourceRef | null) => void): () => void;
  onHover(handler: (source: SourceRef | null) => void): () => void;
}

/**
 * Value equality helper for SourceRef objects.
 */
export function sourceRefEquals(
  a: SourceRef | null | undefined,
  b: SourceRef | null | undefined,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case 'gcode':
      return b.kind === 'gcode' && a.line === b.line;
    case 'heidenhain':
      return b.kind === 'heidenhain' && a.line === b.line;
    case 'svg':
      return b.kind === 'svg' && a.elementId === b.elementId;
    case 'dxf':
      return b.kind === 'dxf' && a.handle === b.handle;
    case 'pdf':
      return b.kind === 'pdf' && a.page === b.page && a.opIndex === b.opIndex;
  }
}
