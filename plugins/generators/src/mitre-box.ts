import type { GeneratorResult, ParamField, PluginGenerator } from '@kmxcnc/plugin-sdk';

export interface MitreBoxParams extends Record<string, unknown> {
  width: number;
  depth: number;
  height: number;
  materialThickness: number;
  tabWidth: number;
  kerf: number;
  lid: boolean;
}

export const MITRE_BOX_PARAMS: ParamField[] = [
  {
    name: 'width',
    label: 'Width (X)',
    type: 'number',
    defaultValue: 70,
    unit: 'mm',
    min: 10,
    max: 2000,
    step: 1,
    required: true,
    order: 1,
  },
  {
    name: 'depth',
    label: 'Depth (Y)',
    type: 'number',
    defaultValue: 50,
    unit: 'mm',
    min: 10,
    max: 2000,
    step: 1,
    required: true,
    order: 2,
  },
  {
    name: 'height',
    label: 'Height (Z)',
    type: 'number',
    defaultValue: 60,
    unit: 'mm',
    min: 10,
    max: 2000,
    step: 1,
    required: true,
    order: 3,
  },
  {
    name: 'materialThickness',
    label: 'Material Thickness',
    type: 'number',
    defaultValue: 4,
    unit: 'mm',
    min: 0.5,
    max: 50,
    step: 0.5,
    required: true,
    order: 4,
  },
  {
    name: 'tabWidth',
    label: 'Finger Tab Width',
    type: 'number',
    defaultValue: 10,
    unit: 'mm',
    min: 2,
    max: 200,
    step: 0.5,
    required: true,
    order: 5,
  },
  {
    name: 'kerf',
    label: 'Kerf Compensation',
    type: 'number',
    defaultValue: 0.1,
    unit: 'mm',
    min: 0,
    max: 2,
    step: 0.05,
    order: 6,
  },
  {
    name: 'lid',
    label: 'Include Lid',
    type: 'boolean',
    defaultValue: true,
    order: 7,
  },
];

type Point = [number, number];

function fmt(n: number): string {
  return Number(n.toFixed(3)).toString();
}

/**
 * Generates points along a single finger-jointed edge from (x0, y0) to (x1, y1).
 * `outwardNormal` points away from the panel interior; `mode`:
 * - 'flat': straight edge
 * - 'tabs': fingers protrude outward by `thickness`
 * - 'slots': notches recede inward by `thickness`
 */
function buildFingerEdge(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  nx: number,
  ny: number,
  thickness: number,
  tabWidth: number,
  kerf: number,
  mode: 'flat' | 'tabs' | 'slots',
): Point[] {
  if (mode === 'flat') {
    return [[x1, y1]];
  }

  const dx = x1 - x0;
  const dy = y1 - y0;
  const length = Math.hypot(dx, dy);
  if (length <= thickness * 2.5) {
    return [[x1, y1]];
  }

  const ux = dx / length;
  const uy = dy / length;

  // Choose an odd number of segments >= 3 so corners are symmetric
  let segments = Math.max(3, Math.round(length / Math.max(2, tabWidth)));
  if (segments % 2 === 0) {
    segments += 1;
  }
  const segLen = length / segments;
  const halfKerf = kerf / 2;
  const depth = mode === 'tabs' ? thickness : -thickness;

  const pts: Point[] = [];
  for (let i = 0; i < segments; i++) {
    const isFeature = i % 2 === 1;
    const tStart = i * segLen;
    const tEnd = (i + 1) * segLen;

    if (isFeature) {
      // Kerf makes tabs slightly wider (+halfKerf each side) and slots slightly narrower (-halfKerf)
      const k = mode === 'tabs' ? -halfKerf : halfKerf;
      const a = Math.max(0, tStart + k);
      const b = Math.min(length, tEnd - k);

      pts.push([x0 + ux * a, y0 + uy * a]);
      pts.push([x0 + ux * a + nx * depth, y0 + uy * a + ny * depth]);
      pts.push([x0 + ux * b + nx * depth, y0 + uy * b + ny * depth]);
      pts.push([x0 + ux * b, y0 + uy * b]);
    }
  }
  pts.push([x1, y1]);
  return pts;
}

interface PanelSpec {
  id: string;
  ox: number;
  oy: number;
  w: number;
  h: number;
  top: 'flat' | 'tabs' | 'slots';
  right: 'flat' | 'tabs' | 'slots';
  bottom: 'flat' | 'tabs' | 'slots';
  left: 'flat' | 'tabs' | 'slots';
}

function buildPanelPath(
  spec: PanelSpec,
  thickness: number,
  tabWidth: number,
  kerf: number,
): string {
  const { ox, oy, w, h } = spec;
  const pts: Point[] = [[ox, oy]];

  // Top edge: (ox, oy) -> (ox + w, oy), outward normal (0, -1)
  pts.push(...buildFingerEdge(ox, oy, ox + w, oy, 0, -1, thickness, tabWidth, kerf, spec.top));
  // Right edge: (ox + w, oy) -> (ox + w, oy + h), outward normal (1, 0)
  pts.push(...buildFingerEdge(ox + w, oy, ox + w, oy + h, 1, 0, thickness, tabWidth, kerf, spec.right));
  // Bottom edge: (ox + w, oy + h) -> (ox, oy + h), outward normal (0, 1)
  pts.push(...buildFingerEdge(ox + w, oy + h, ox, oy + h, 0, 1, thickness, tabWidth, kerf, spec.bottom));
  // Left edge: (ox, oy + h) -> (ox, oy), outward normal (-1, 0)
  pts.push(...buildFingerEdge(ox, oy + h, ox, oy, -1, 0, thickness, tabWidth, kerf, spec.left));

  const commands = pts.map(([x, y], idx) => `${idx === 0 ? 'M' : 'L'}${fmt(x)} ${fmt(y)}`);
  commands.push('Z');
  return commands.join(' ');
}

export function generateMitreBoxSvg(rawParams: Partial<MitreBoxParams> = {}): string {
  const width = Math.max(10, Number(rawParams.width ?? 70));
  const depth = Math.max(10, Number(rawParams.depth ?? 50));
  const height = Math.max(10, Number(rawParams.height ?? 60));
  const thick = Math.max(0.5, Number(rawParams.materialThickness ?? 4));
  const tabWidth = Math.max(2, Number(rawParams.tabWidth ?? 10));
  const kerf = Math.max(0, Number(rawParams.kerf ?? 0.1));
  const lid = rawParams.lid !== undefined ? Boolean(rawParams.lid) : true;

  const pad = thick + 4;
  const gap = thick * 2 + 6;
  const topEdgeMode: 'flat' | 'slots' = lid ? 'slots' : 'flat';

  // Inner dimensions so outer assembled dimensions match width x depth x height
  const innerW = Math.max(thick * 2, width - thick * 2);
  const innerD = Math.max(thick * 2, depth - thick * 2);
  const innerH = Math.max(thick * 2, height - (lid ? thick * 2 : thick));

  const panels: PanelSpec[] = [
    // Row 1: Front, Back, Left, Right
    {
      id: 'front',
      ox: pad,
      oy: pad,
      w: innerW,
      h: innerH,
      top: topEdgeMode,
      right: 'tabs',
      bottom: 'slots',
      left: 'tabs',
    },
    {
      id: 'back',
      ox: pad + innerW + gap,
      oy: pad,
      w: innerW,
      h: innerH,
      top: topEdgeMode,
      right: 'tabs',
      bottom: 'slots',
      left: 'tabs',
    },
    {
      id: 'left',
      ox: pad,
      oy: pad + innerH + gap,
      w: innerD,
      h: innerH,
      top: topEdgeMode,
      right: 'slots',
      bottom: 'slots',
      left: 'slots',
    },
    {
      id: 'right',
      ox: pad + innerD + gap,
      oy: pad + innerH + gap,
      w: innerD,
      h: innerH,
      top: topEdgeMode,
      right: 'slots',
      bottom: 'slots',
      left: 'slots',
    },
    // Row 3: Bottom (+ optional Lid)
    {
      id: 'bottom',
      ox: pad,
      oy: pad + (innerH + gap) * 2,
      w: innerW,
      h: innerD,
      top: 'tabs',
      right: 'tabs',
      bottom: 'tabs',
      left: 'tabs',
    },
  ];

  if (lid) {
    panels.push({
      id: 'lid',
      ox: pad + innerW + gap,
      oy: pad + (innerH + gap) * 2,
      w: innerW,
      h: innerD,
      top: 'tabs',
      right: 'tabs',
      bottom: 'tabs',
      left: 'tabs',
    });
  }

  const totalW = Math.max(pad * 2 + innerW * 2 + gap, pad * 2 + innerD * 2 + gap);
  const totalH = pad * 2 + innerH * 2 + innerD + gap * 2;

  const paths = panels
    .map(
      (panel) =>
        `  <path id="panel-${panel.id}" d="${buildPanelPath(panel, thick, tabWidth, kerf)}" fill="none" stroke="#000000" stroke-width="0.2" />`,
    )
    .join('\n');

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(totalW)}mm" height="${fmt(totalH)}mm" viewBox="0 0 ${fmt(totalW)} ${fmt(totalH)}">`,
    `  <g id="mitre-box">`,
    paths,
    `  </g>`,
    `</svg>`,
  ].join('\n');
}

export const mitreBoxGenerator: PluginGenerator<MitreBoxParams> = {
  id: 'mitre-box',
  name: 'Mitre / Finger-Joint Box',
  description: 'Parametric finger-joint box panels with kerf compensation and optional lid.',
  category: 'Enclosures',
  params: MITRE_BOX_PARAMS,
  generate(params): GeneratorResult {
    return {
      svg: generateMitreBoxSvg(params),
      suggestedFilename: `mitre-box-${params.width ?? 70}x${params.depth ?? 50}x${params.height ?? 60}.svg`,
    };
  },
};
