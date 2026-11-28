import type { DockviewApi, SerializedDockview } from 'dockview';

export type AxisKey = 'X' | 'Y' | 'Z' | 'A' | 'B' | 'C' | 'U' | 'V';

export type UiProfileId =
  | 'mill-3axis'
  | 'mill-4axis-rotary'
  | '8axis'
  | 'lathe-2axis'
  | 'laser-compact'
  | 'touch-big-jog';

export type UiDensity = 'desktop' | 'touch';

export interface UiProfile {
  id: UiProfileId;
  label: string;
  description: string;
  axes: AxisKey[];
  density: UiDensity;
  layoutMode: 'dockview' | 'touch-grid';
  defaultDiameterMode: boolean;
  defaultRotary4thAxis: boolean;
  showSpindleOverrides: boolean;
  compactControls?: boolean;
}

export const UI_PROFILES: Record<UiProfileId, UiProfile> = {
  'mill-3axis': {
    id: 'mill-3axis',
    label: 'Mill 3-Axis',
    description: 'Standard 3-axis milling workspace (X, Y, Z)',
    axes: ['X', 'Y', 'Z'],
    density: 'desktop',
    layoutMode: 'dockview',
    defaultDiameterMode: false,
    defaultRotary4thAxis: false,
    showSpindleOverrides: true,
  },
  'mill-4axis-rotary': {
    id: 'mill-4axis-rotary',
    label: 'Mill 4-Axis Rotary',
    description: '4-axis milling with rotary A-axis & cylindrical 3D projection',
    axes: ['X', 'Y', 'Z', 'A'],
    density: 'desktop',
    layoutMode: 'dockview',
    defaultDiameterMode: false,
    defaultRotary4thAxis: true,
    showSpindleOverrides: true,
  },
  '8axis': {
    id: '8axis',
    label: '8-Axis Full',
    description: 'Full 8-axis KFLOP/Kogna DRO & diagnostics (X–V)',
    axes: ['X', 'Y', 'Z', 'A', 'B', 'C', 'U', 'V'],
    density: 'desktop',
    layoutMode: 'dockview',
    defaultDiameterMode: false,
    defaultRotary4thAxis: false,
    showSpindleOverrides: true,
  },
  'lathe-2axis': {
    id: 'lathe-2axis',
    label: 'Lathe 2-Axis',
    description: '2-axis turning workspace (X, Z) with Diameter Mode enabled',
    axes: ['X', 'Z'],
    density: 'desktop',
    layoutMode: 'dockview',
    defaultDiameterMode: true,
    defaultRotary4thAxis: false,
    showSpindleOverrides: true,
  },
  'laser-compact': {
    id: 'laser-compact',
    label: 'Laser Compact',
    description: 'Streamlined XY+Z laser cutter layout with large 3D preview',
    axes: ['X', 'Y', 'Z'],
    density: 'desktop',
    layoutMode: 'dockview',
    defaultDiameterMode: false,
    defaultRotary4thAxis: false,
    showSpindleOverrides: false,
    compactControls: true,
  },
  'touch-big-jog': {
    id: 'touch-big-jog',
    label: 'Touch Big Jog',
    description: 'Workshop touchscreen layout with oversized DRO, jog & run controls',
    axes: ['X', 'Y', 'Z'],
    density: 'touch',
    layoutMode: 'touch-grid',
    defaultDiameterMode: false,
    defaultRotary4thAxis: false,
    showSpindleOverrides: true,
  },
};

export const UI_PROFILE_LIST: UiProfile[] = Object.values(UI_PROFILES);

const LAYOUT_STORAGE_PREFIX = 'kmxcnc:dockview-layout:v1:';

export function loadSavedLayout(profileId: UiProfileId): SerializedDockview | null {
  try {
    const raw = localStorage.getItem(`${LAYOUT_STORAGE_PREFIX}${profileId}`);
    if (!raw) return null;
    return JSON.parse(raw) as SerializedDockview;
  } catch {
    return null;
  }
}

export function saveLayout(profileId: UiProfileId, layout: SerializedDockview): void {
  try {
    localStorage.setItem(`${LAYOUT_STORAGE_PREFIX}${profileId}`, JSON.stringify(layout));
  } catch {
    // Ignore storage quota errors
  }
}

export function clearSavedLayout(profileId: UiProfileId): void {
  try {
    localStorage.removeItem(`${LAYOUT_STORAGE_PREFIX}${profileId}`);
  } catch {
    // Ignore
  }
}

export function applyDefaultDockviewLayout(api: DockviewApi, profileId: UiProfileId): void {
  api.clear();

  if (profileId === 'laser-compact') {
    const viewer = api.addPanel({
      id: 'viewer-3d',
      component: 'viewer-3d',
      title: '3D Toolpath',
    });
    const dro = api.addPanel({
      id: 'dro',
      component: 'dro',
      title: 'DRO',
      position: { referencePanel: viewer, direction: 'left' },
    });
    api.addPanel({
      id: 'controls',
      component: 'controls',
      title: 'Execution & MDI',
      position: { referencePanel: dro, direction: 'below' },
    });
    api.addPanel({
      id: 'jog',
      component: 'jog',
      title: 'Jog Pad',
      position: { referencePanel: 'controls', direction: 'below' },
    });
    const editor = api.addPanel({
      id: 'gcode-editor',
      component: 'gcode-editor',
      title: 'G-Code',
      position: { referencePanel: viewer, direction: 'below' },
    });
    api.addPanel({
      id: 'logs',
      component: 'logs',
      title: 'Logs',
      position: { referencePanel: editor, direction: 'within' },
    });
    dro.group.api.setSize({ width: 320 });
    editor.group.api.setSize({ height: 220 });
    return;
  }

  // Standard 3-column workshop layout: Left (DRO + Jog), Center (3D Viewer + Logs), Right (Controls + G-Code)
  const viewer = api.addPanel({
    id: 'viewer-3d',
    component: 'viewer-3d',
    title: '3D Toolpath',
  });

  const dro = api.addPanel({
    id: 'dro',
    component: 'dro',
    title: 'DRO',
    position: { referencePanel: viewer, direction: 'left' },
  });

  const jog = api.addPanel({
    id: 'jog',
    component: 'jog',
    title: 'Jog Pad',
    position: { referencePanel: dro, direction: 'below' },
  });

  const logs = api.addPanel({
    id: 'logs',
    component: 'logs',
    title: 'Logs',
    position: { referencePanel: viewer, direction: 'below' },
  });

  const controls = api.addPanel({
    id: 'controls',
    component: 'controls',
    title: 'Controls & MDI',
    position: { referencePanel: viewer, direction: 'right' },
  });

  const editor = api.addPanel({
    id: 'gcode-editor',
    component: 'gcode-editor',
    title: 'G-Code Editor',
    position: { referencePanel: controls, direction: 'below' },
  });

  dro.group.api.setSize({ width: profileId === '8axis' ? 350 : 300 });
  jog.group.api.setSize({ height: 270 });
  controls.group.api.setSize({ width: 360, height: 320 });
  logs.group.api.setSize({ height: 190 });
  editor.group.api.setSize({ height: 360 });
}
