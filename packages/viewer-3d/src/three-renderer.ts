import {
  AmbientLight,
  AxesHelper,
  Box3,
  BoxGeometry,
  BufferGeometry,
  Color,
  ConeGeometry,
  DirectionalLight,
  EdgesGeometry,
  Float32BufferAttribute,
  GridHelper,
  Group,
  LineBasicMaterial,
  LineDashedMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Sphere,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { MoveKind, SourceRef } from '@kmxcnc/igm';
import {
  sourceRefEquals,
  type CameraPreset,
  type MachineBounds,
  type RenderLayerBuffer,
  type RenderSceneData,
  type ToolpathRenderer,
  type Vec3,
  type ViewerTheme,
} from './types';

interface ThemePalette {
  background: number;
  gridPrimary: number;
  gridSecondary: number;
  bounds: number;
  rapid: number;
  cut: number;
  geometry: number;
  highlight: number;
  tool: number;
  toolCrosshair: number;
}

const THEME_PALETTES: Record<ViewerTheme, ThemePalette> = {
  dark: {
    background: 0x0f172a,
    gridPrimary: 0x334155,
    gridSecondary: 0x1e293b,
    bounds: 0x475569,
    rapid: 0xf59e0b,
    cut: 0x22d3ee,
    geometry: 0xa78bfa,
    highlight: 0xf43f5e,
    tool: 0x10b981,
    toolCrosshair: 0x34d399,
  },
  light: {
    background: 0xf8fafc,
    gridPrimary: 0x94a3b8,
    gridSecondary: 0xe2e8f0,
    bounds: 0x64748b,
    rapid: 0xd97706,
    cut: 0x0284c7,
    geometry: 0x7c3aed,
    highlight: 0xe11d48,
    tool: 0x059669,
    toolCrosshair: 0x10b981,
  },
};

const CLICK_DRAG_THRESHOLD_PX = 5;

export interface ThreeToolpathRendererOptions {
  theme?: ViewerTheme;
  antialias?: boolean;
}

/**
 * Three.js implementation of ToolpathRenderer with Z-up CNC coordinates,
 * on-demand rendering, work-envelope wireframe, live tool marker, and
 * bidirectional SourceRef raycast picking.
 */
export class ThreeToolpathRenderer implements ToolpathRenderer {
  private container: HTMLElement | null = null;
  private renderer: WebGLRenderer | null = null;
  private scene: Scene | null = null;
  private camera: PerspectiveCamera | null = null;
  private controls: OrbitControls | null = null;

  private toolpathGroup: Group | null = null;
  private highlightLine: LineSegments | null = null;
  private boundsLine: LineSegments | null = null;
  private gridHelper: GridHelper | null = null;
  private axesHelper: AxesHelper | null = null;
  private toolMarker: Group | null = null;

  private theme: ViewerTheme;
  private antialias: boolean;
  private currentScene: RenderSceneData | null = null;
  private currentBounds: MachineBounds | null = null;
  private currentToolPos: Vec3 = { x: 0, y: 0, z: 0 };
  private currentHighlight: SourceRef | null = null;
  private lastHovered: SourceRef | null = null;

  private readonly selectHandlers = new Set<(source: SourceRef | null) => void>();
  private readonly hoverHandlers = new Set<(source: SourceRef | null) => void>();

  private readonly raycaster = new Raycaster();
  private readonly pointerNdc = new Vector2();
  private pointerDownPos: { x: number; y: number } | null = null;

  private rafId: number | null = null;
  private mounted = false;

  constructor(options?: ThreeToolpathRendererOptions) {
    this.theme = options?.theme ?? 'dark';
    this.antialias = options?.antialias ?? true;
  }

  mount(container: HTMLElement): void {
    if (this.mounted) {
      this.unmount();
    }
    this.container = container;
    this.mounted = true;

    const palette = THEME_PALETTES[this.theme];
    const width = Math.max(container.clientWidth || 640, 1);
    const height = Math.max(container.clientHeight || 480, 1);

    const scene = new Scene();
    scene.background = new Color(palette.background);
    this.scene = scene;

    // Z-up CNC coordinate system
    const camera = new PerspectiveCamera(45, width / height, 0.1, 50000);
    camera.up.set(0, 0, 1);
    camera.position.set(200, -220, 180);
    this.camera = camera;

    const renderer = new WebGLRenderer({
      antialias: this.antialias,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false; // Keep on-demand rendering deterministic
    controls.screenSpacePanning = true;
    controls.target.set(0, 0, 0);
    controls.update();
    controls.addEventListener('change', this.handleControlsChange);
    this.controls = controls;

    // Subtle lighting for 3D tool cone
    const ambient = new AmbientLight(0xffffff, 0.8);
    const dirLight = new DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(150, -150, 300);
    scene.add(ambient, dirLight);

    // Axes helper at world origin
    const axes = new AxesHelper(30);
    scene.add(axes);
    this.axesHelper = axes;

    // Toolpath group
    const toolpathGroup = new Group();
    toolpathGroup.name = 'toolpaths';
    scene.add(toolpathGroup);
    this.toolpathGroup = toolpathGroup;

    // Build grid, bounds, tool marker, and any already-set scene data
    this.rebuildGridAndBounds();
    this.rebuildToolMarker();
    if (this.currentScene) {
      this.rebuildToolpaths(this.currentScene);
      this.rebuildHighlight();
    }

    // Attach pointer listeners for picking
    const dom = renderer.domElement;
    dom.addEventListener('pointerdown', this.handlePointerDown);
    dom.addEventListener('pointerup', this.handlePointerUp);
    dom.addEventListener('pointermove', this.handlePointerMove);
    dom.addEventListener('pointerleave', this.handlePointerLeave);

    this.setCameraPreset('iso');
    this.requestRender();
  }

  unmount(): void {
    if (!this.mounted) return;
    this.mounted = false;

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    if (this.renderer) {
      const dom = this.renderer.domElement;
      dom.removeEventListener('pointerdown', this.handlePointerDown);
      dom.removeEventListener('pointerup', this.handlePointerUp);
      dom.removeEventListener('pointermove', this.handlePointerMove);
      dom.removeEventListener('pointerleave', this.handlePointerLeave);
      if (dom.parentElement === this.container) {
        this.container?.removeChild(dom);
      }
    }

    if (this.controls) {
      this.controls.removeEventListener('change', this.handleControlsChange);
      this.controls.dispose();
      this.controls = null;
    }

    this.disposeToolpaths();
    this.disposeHighlight();
    this.disposeBounds();
    this.disposeGrid();
    this.disposeToolMarker();

    if (this.axesHelper) {
      this.axesHelper.geometry.dispose();
      if (Array.isArray(this.axesHelper.material)) {
        for (const mat of this.axesHelper.material) mat.dispose();
      } else {
        this.axesHelper.material.dispose();
      }
      this.scene?.remove(this.axesHelper);
      this.axesHelper = null;
    }

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }

    this.scene = null;
    this.camera = null;
    this.toolpathGroup = null;
    this.container = null;
    this.lastHovered = null;
  }

  resize(width: number, height: number): void {
    const safeW = Math.max(Math.floor(width), 1);
    const safeH = Math.max(Math.floor(height), 1);
    if (this.camera) {
      this.camera.aspect = safeW / safeH;
      this.camera.updateProjectionMatrix();
    }
    if (this.renderer) {
      this.renderer.setSize(safeW, safeH, false);
    }
    this.requestRender();
  }

  setScene(data: RenderSceneData): void {
    this.currentScene = data;
    if (this.mounted) {
      this.rebuildToolpaths(data);
      this.rebuildHighlight();
      this.requestRender();
    }
  }

  setMachineBounds(bounds: MachineBounds): void {
    this.currentBounds = bounds;
    if (this.mounted) {
      this.rebuildGridAndBounds();
      this.requestRender();
    }
  }

  setToolPosition(pos: Vec3): void {
    this.currentToolPos = { x: pos.x, y: pos.y, z: pos.z };
    if (this.toolMarker) {
      this.toolMarker.position.set(pos.x, pos.y, pos.z);
      this.requestRender();
    }
  }

  setHighlight(source: SourceRef | null): void {
    if (sourceRefEquals(this.currentHighlight, source)) return;
    this.currentHighlight = source;
    if (this.mounted) {
      this.rebuildHighlight();
      this.requestRender();
    }
  }

  setTheme(theme: ViewerTheme): void {
    if (this.theme === theme) return;
    this.theme = theme;
    if (!this.mounted || !this.scene) return;

    const palette = THEME_PALETTES[theme];
    this.scene.background = new Color(palette.background);
    this.rebuildGridAndBounds();
    this.rebuildToolMarker();
    if (this.currentScene) {
      this.rebuildToolpaths(this.currentScene);
      this.rebuildHighlight();
    }
    this.requestRender();
  }

  setCameraPreset(preset: CameraPreset): void {
    if (!this.camera || !this.controls) return;

    const { center, radius } = this.computeFocusSphere();
    const fovRad = (this.camera.fov * Math.PI) / 180;
    const dist = Math.max((radius / Math.sin(fovRad / 2)) * 1.15, 25);

    this.controls.target.copy(center);

    switch (preset) {
      case 'top':
        // Tiny negative Y offset avoids gimbal lock with Z-up camera
        this.camera.position.set(center.x, center.y - dist * 0.0005, center.z + dist);
        break;
      case 'front':
        this.camera.position.set(center.x, center.y - dist, center.z);
        break;
      case 'iso': {
        const dir = new Vector3(0.65, -0.75, 0.65).normalize();
        this.camera.position.copy(center).addScaledVector(dir, dist);
        break;
      }
      case 'fit': {
        const dir = this.camera.position.clone().sub(this.controls.target);
        if (dir.lengthSq() < 1e-6) {
          dir.set(0.65, -0.75, 0.65);
        }
        dir.normalize();
        this.camera.position.copy(center).addScaledVector(dir, dist);
        break;
      }
    }

    this.camera.near = Math.max(dist * 0.001, 0.05);
    this.camera.far = Math.max(dist * 20, 10000);
    this.camera.updateProjectionMatrix();
    this.controls.update();
    this.requestRender();
  }

  onSelect(handler: (source: SourceRef | null) => void): () => void {
    this.selectHandlers.add(handler);
    return () => {
      this.selectHandlers.delete(handler);
    };
  }

  onHover(handler: (source: SourceRef | null) => void): () => void {
    this.hoverHandlers.add(handler);
    return () => {
      this.hoverHandlers.delete(handler);
    };
  }

  // --- Internal rendering ---

  private requestRender(): void {
    if (!this.mounted || this.rafId !== null) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.renderFrame();
    });
  }

  private renderFrame(): void {
    if (!this.mounted || !this.renderer || !this.scene || !this.camera) return;
    this.renderer.render(this.scene, this.camera);
  }

  private readonly handleControlsChange = (): void => {
    this.requestRender();
  };

  // --- Scene construction ---

  private computeFocusSphere(): { center: Vector3; radius: number } {
    const box = new Box3();
    if (this.currentScene && this.currentScene.totalSegments > 0) {
      const { min, max } = this.currentScene.bounds;
      box.min.set(min.x, min.y, min.z);
      box.max.set(max.x, max.y, max.z);
    } else if (this.currentBounds) {
      const b = this.currentBounds;
      box.min.set(b.minX, b.minY, b.minZ);
      box.max.set(b.maxX, b.maxY, b.maxZ);
    } else {
      box.min.set(-100, -100, 0);
      box.max.set(100, 100, 50);
    }

    const sphere = new Sphere();
    box.getBoundingSphere(sphere);
    return {
      center: sphere.center,
      radius: Math.max(sphere.radius, 10),
    };
  }

  private rebuildGridAndBounds(): void {
    if (!this.scene) return;
    this.disposeGrid();
    this.disposeBounds();

    const palette = THEME_PALETTES[this.theme];
    const bounds = this.currentBounds;

    let gridSize = 400;
    let centerX = 0;
    let centerY = 0;

    if (bounds) {
      const sizeX = Math.max(bounds.maxX - bounds.minX, 1);
      const sizeY = Math.max(bounds.maxY - bounds.minY, 1);
      const sizeZ = Math.max(bounds.maxZ - bounds.minZ, 1);
      centerX = (bounds.minX + bounds.maxX) / 2;
      centerY = (bounds.minY + bounds.maxY) / 2;
      const centerZ = (bounds.minZ + bounds.maxZ) / 2;

      gridSize = Math.ceil(Math.max(sizeX, sizeY) / 50) * 50 + 100;

      const boxGeom = new BoxGeometry(sizeX, sizeY, sizeZ);
      const edgesGeom = new EdgesGeometry(boxGeom);
      boxGeom.dispose();

      const boundsMat = new LineBasicMaterial({
        color: palette.bounds,
        transparent: true,
        opacity: 0.6,
      });
      const boundsLine = new LineSegments(edgesGeom, boundsMat);
      boundsLine.position.set(centerX, centerY, centerZ);
      this.scene.add(boundsLine);
      this.boundsLine = boundsLine;
    }

    const divisions = Math.max(10, Math.min(80, Math.round(gridSize / 10)));
    const grid = new GridHelper(gridSize, divisions, palette.gridPrimary, palette.gridSecondary);
    // Rotate XZ grid onto XY plane (Z-up)
    grid.rotation.x = Math.PI / 2;
    grid.position.set(centerX, centerY, 0);
    this.scene.add(grid);
    this.gridHelper = grid;
  }

  private rebuildToolMarker(): void {
    if (!this.scene) return;
    this.disposeToolMarker();

    const palette = THEME_PALETTES[this.theme];
    const group = new Group();
    group.name = 'tool-marker';

    // Inverted cone: tip at (0,0,0), base at z = +coneHeight
    const coneHeight = 14;
    const coneRadius = 3.5;
    const coneGeom = new ConeGeometry(coneRadius, coneHeight, 16);
    // ConeGeometry points along +Y with center at origin; rotate so tip points -Z and sits at z=0
    coneGeom.rotateX(-Math.PI / 2);
    coneGeom.translate(0, 0, coneHeight / 2);
    const coneMat = new MeshStandardMaterial({
      color: palette.tool,
      roughness: 0.35,
      metalness: 0.3,
    });
    const cone = new Mesh(coneGeom, coneMat);
    group.add(cone);

    // Crosshair at tool tip
    const r = 6;
    const crossGeom = new BufferGeometry();
    crossGeom.setAttribute(
      'position',
      new Float32BufferAttribute(
        [-r, 0, 0, r, 0, 0, 0, -r, 0, 0, r, 0],
        3,
      ),
    );
    const crossMat = new LineBasicMaterial({ color: palette.toolCrosshair });
    const cross = new LineSegments(crossGeom, crossMat);
    group.add(cross);

    group.position.set(this.currentToolPos.x, this.currentToolPos.y, this.currentToolPos.z);
    this.scene.add(group);
    this.toolMarker = group;
  }

  private rebuildToolpaths(data: RenderSceneData): void {
    if (!this.toolpathGroup) return;
    this.disposeToolpaths();

    const palette = THEME_PALETTES[this.theme];

    for (const layer of data.layers) {
      if (layer.segmentCount === 0 || layer.positions.length === 0) continue;

      const geom = new BufferGeometry();
      geom.setAttribute('position', new Float32BufferAttribute(layer.positions, 3));

      const mat = this.createLayerMaterial(layer.kind, palette);
      const line = new LineSegments(geom, mat);
      line.userData = { layerBuffer: layer };

      if (layer.kind === 'rapid') {
        line.computeLineDistances();
      }

      this.toolpathGroup.add(line);
    }
  }

  private createLayerMaterial(
    kind: MoveKind,
    palette: ThemePalette,
  ): LineBasicMaterial | LineDashedMaterial {
    switch (kind) {
      case 'rapid':
        return new LineDashedMaterial({
          color: palette.rapid,
          dashSize: 3,
          gapSize: 2,
          transparent: true,
          opacity: 0.75,
        });
      case 'cut':
        return new LineBasicMaterial({
          color: palette.cut,
        });
      case 'geometry':
        return new LineBasicMaterial({
          color: palette.geometry,
        });
    }
  }

  private rebuildHighlight(): void {
    if (!this.scene) return;
    this.disposeHighlight();

    const target = this.currentHighlight;
    const data = this.currentScene;
    if (!target || !data) return;

    const coords: number[] = [];
    for (const layer of data.layers) {
      const refs = layer.sourceRefs;
      const pos = layer.positions;
      for (let i = 0; i < refs.length; i++) {
        if (sourceRefEquals(refs[i], target)) {
          const base = i * 6;
          coords.push(
            pos[base]!,
            pos[base + 1]!,
            pos[base + 2]!,
            pos[base + 3]!,
            pos[base + 4]!,
            pos[base + 5]!,
          );
        }
      }
    }

    if (coords.length === 0) return;

    const palette = THEME_PALETTES[this.theme];
    const geom = new BufferGeometry();
    geom.setAttribute('position', new Float32BufferAttribute(new Float32Array(coords), 3));
    const mat = new LineBasicMaterial({
      color: palette.highlight,
      depthTest: false,
    });
    const line = new LineSegments(geom, mat);
    line.renderOrder = 10;
    this.scene.add(line);
    this.highlightLine = line;
  }

  // --- Picking / Raycasting ---

  private pickSourceAt(clientX: number, clientY: number): SourceRef | null {
    if (!this.renderer || !this.camera || !this.toolpathGroup) return null;
    if (this.toolpathGroup.children.length === 0) return null;

    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    this.pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    const target = this.controls?.target ?? new Vector3();
    const dist = this.camera.position.distanceTo(target);
    this.raycaster.params.Line.threshold = Math.max(0.5, dist * 0.015);
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);

    const hits = this.raycaster.intersectObjects(this.toolpathGroup.children, false);
    for (const hit of hits) {
      const layerBuffer = hit.object.userData?.layerBuffer as RenderLayerBuffer | undefined;
      if (!layerBuffer || hit.index === undefined) continue;
      const segIdx = Math.floor(hit.index / 2);
      const ref = layerBuffer.sourceRefs[segIdx] ?? null;
      if (ref) return ref;
    }
    return null;
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    this.pointerDownPos = { x: event.clientX, y: event.clientY };
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    if (event.button !== 0 || !this.pointerDownPos) return;
    const dx = event.clientX - this.pointerDownPos.x;
    const dy = event.clientY - this.pointerDownPos.y;
    this.pointerDownPos = null;

    if (Math.hypot(dx, dy) > CLICK_DRAG_THRESHOLD_PX) return;
    if (this.selectHandlers.size === 0) return;

    const picked = this.pickSourceAt(event.clientX, event.clientY);
    for (const handler of this.selectHandlers) {
      handler(picked);
    }
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (this.hoverHandlers.size === 0) return;
    // Skip hover picking while dragging the camera
    if (event.buttons !== 0) return;

    const picked = this.pickSourceAt(event.clientX, event.clientY);
    if (!sourceRefEquals(picked, this.lastHovered)) {
      this.lastHovered = picked;
      for (const handler of this.hoverHandlers) {
        handler(picked);
      }
    }
  };

  private readonly handlePointerLeave = (): void => {
    this.pointerDownPos = null;
    if (this.lastHovered !== null) {
      this.lastHovered = null;
      for (const handler of this.hoverHandlers) {
        handler(null);
      }
    }
  };

  // --- Resource disposal ---

  private disposeToolpaths(): void {
    if (!this.toolpathGroup) return;
    while (this.toolpathGroup.children.length > 0) {
      const child = this.toolpathGroup.children[0];
      if (!child) break;
      this.toolpathGroup.remove(child);
      if (child instanceof LineSegments) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          for (const mat of child.material) mat.dispose();
        } else {
          child.material.dispose();
        }
      }
    }
  }

  private disposeHighlight(): void {
    if (!this.highlightLine) return;
    this.scene?.remove(this.highlightLine);
    this.highlightLine.geometry.dispose();
    if (Array.isArray(this.highlightLine.material)) {
      for (const mat of this.highlightLine.material) mat.dispose();
    } else {
      this.highlightLine.material.dispose();
    }
    this.highlightLine = null;
  }

  private disposeBounds(): void {
    if (!this.boundsLine) return;
    this.scene?.remove(this.boundsLine);
    this.boundsLine.geometry.dispose();
    if (Array.isArray(this.boundsLine.material)) {
      for (const mat of this.boundsLine.material) mat.dispose();
    } else {
      this.boundsLine.material.dispose();
    }
    this.boundsLine = null;
  }

  private disposeGrid(): void {
    if (!this.gridHelper) return;
    this.scene?.remove(this.gridHelper);
    this.gridHelper.geometry.dispose();
    if (Array.isArray(this.gridHelper.material)) {
      for (const mat of this.gridHelper.material) mat.dispose();
    } else {
      this.gridHelper.material.dispose();
    }
    this.gridHelper = null;
  }

  private disposeToolMarker(): void {
    if (!this.toolMarker) return;
    this.scene?.remove(this.toolMarker);
    for (const child of this.toolMarker.children) {
      if (child instanceof Mesh || child instanceof LineSegments) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          for (const mat of child.material) mat.dispose();
        } else {
          child.material.dispose();
        }
      }
    }
    this.toolMarker = null;
  }
}
