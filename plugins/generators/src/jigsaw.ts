import type { GeneratorResult, ParamField, PluginGenerator } from '@kmxcnc/plugin-sdk';

export interface JigsawParams extends Record<string, unknown> {
  width: number;
  height: number;
  rows: number;
  cols: number;
  tabSize: number;
  seed: number;
}

export const JIGSAW_PARAMS: ParamField[] = [
  {
    name: 'width',
    label: 'Width',
    type: 'number',
    defaultValue: 200,
    unit: 'mm',
    min: 20,
    max: 2000,
    step: 5,
    required: true,
    order: 1,
  },
  {
    name: 'height',
    label: 'Height',
    type: 'number',
    defaultValue: 150,
    unit: 'mm',
    min: 20,
    max: 2000,
    step: 5,
    required: true,
    order: 2,
  },
  {
    name: 'rows',
    label: 'Rows',
    type: 'number',
    defaultValue: 4,
    min: 1,
    max: 40,
    step: 1,
    required: true,
    order: 3,
  },
  {
    name: 'cols',
    label: 'Columns',
    type: 'number',
    defaultValue: 5,
    min: 1,
    max: 40,
    step: 1,
    required: true,
    order: 4,
  },
  {
    name: 'tabSize',
    label: 'Tab Size',
    type: 'number',
    defaultValue: 20,
    unit: '%',
    min: 10,
    max: 35,
    step: 1,
    order: 5,
  },
  {
    name: 'seed',
    label: 'Random Seed',
    type: 'number',
    defaultValue: 42,
    min: 0,
    max: 999999,
    step: 1,
    order: 6,
  },
];

function fmt(n: number): string {
  return Number(n.toFixed(3)).toString();
}

/** Deterministic Mulberry32 PRNG. */
function createRng(seed: number): () => number {
  let state = (seed | 0) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Emits a smooth classic jigsaw tab cubic-bezier edge from (x0, y0) to (x1, y1).
 */
function buildJigsawEdge(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  tabRatio: number,
  rng: () => number,
): string {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  // Normal vector
  const flip = rng() < 0.5 ? -1 : 1;
  const nx = -uy * flip;
  const ny = ux * flip;

  const jitter = (range: number) => (rng() - 0.5) * 2 * range;

  const t = tabRatio;
  const neck = 0.38 + jitter(0.03);
  const neck2 = 1 - neck;
  const shoulderY = (0.04 + jitter(0.015)) * len;
  const tabHeight = (t + jitter(0.02)) * len;
  const headBulge = (0.08 + jitter(0.015)) * len;

  const pt = (along: number, perp: number): [number, number] => [
    x0 + ux * along + nx * perp,
    y0 + uy * along + ny * perp,
  ];

  const p0 = pt(0, 0);
  const c1 = pt(len * 0.2, shoulderY);
  const c2 = pt(len * (neck - 0.04), -shoulderY * 0.5);
  const p1 = pt(len * neck, tabHeight * 0.22);

  const c3 = pt(len * (neck - 0.07) - headBulge * 0.25, tabHeight * 0.85);
  const c4 = pt(len * (neck2 + 0.07) + headBulge * 0.25, tabHeight * 0.85);
  const p2 = pt(len * neck2, tabHeight * 0.22);

  const c5 = pt(len * (neck2 + 0.04), -shoulderY * 0.5);
  const c6 = pt(len * 0.8, shoulderY);
  const p3 = pt(len, 0);

  return [
    `M${fmt(p0[0])} ${fmt(p0[1])}`,
    `C${fmt(c1[0])} ${fmt(c1[1])}, ${fmt(c2[0])} ${fmt(c2[1])}, ${fmt(p1[0])} ${fmt(p1[1])}`,
    `C${fmt(c3[0])} ${fmt(c3[1])}, ${fmt(c4[0])} ${fmt(c4[1])}, ${fmt(p2[0])} ${fmt(p2[1])}`,
    `C${fmt(c5[0])} ${fmt(c5[1])}, ${fmt(c6[0])} ${fmt(c6[1])}, ${fmt(p3[0])} ${fmt(p3[1])}`,
  ].join(' ');
}

export function generateJigsawSvg(rawParams: Partial<JigsawParams> = {}): string {
  const width = Math.max(20, Number(rawParams.width ?? 200));
  const height = Math.max(20, Number(rawParams.height ?? 150));
  const rows = Math.max(1, Math.floor(Number(rawParams.rows ?? 4)));
  const cols = Math.max(1, Math.floor(Number(rawParams.cols ?? 5)));
  const tabSize = Math.max(10, Math.min(35, Number(rawParams.tabSize ?? 20)));
  const seed = Math.floor(Number(rawParams.seed ?? 42));

  const rng = createRng(seed);
  const tabRatio = tabSize / 100;
  const cellW = width / cols;
  const cellH = height / rows;
  const pad = 2;

  const horizontalPaths: string[] = [];
  for (let r = 1; r < rows; r++) {
    const y = pad + r * cellH;
    for (let c = 0; c < cols; c++) {
      const x0 = pad + c * cellW;
      const x1 = x0 + cellW;
      horizontalPaths.push(buildJigsawEdge(x0, y, x1, y, tabRatio, rng));
    }
  }

  const verticalPaths: string[] = [];
  for (let c = 1; c < cols; c++) {
    const x = pad + c * cellW;
    for (let r = 0; r < rows; r++) {
      const y0 = pad + r * cellH;
      const y1 = y0 + cellH;
      verticalPaths.push(buildJigsawEdge(x, y0, x, y1, tabRatio, rng));
    }
  }

  const totalW = width + pad * 2;
  const totalH = height + pad * 2;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(totalW)}mm" height="${fmt(totalH)}mm" viewBox="0 0 ${fmt(totalW)} ${fmt(totalH)}">`,
    `  <g id="jigsaw-horizontal" fill="none" stroke="#000000" stroke-width="0.2">`,
    horizontalPaths.length > 0
      ? `    <path id="jigsaw-h-cuts" d="${horizontalPaths.join(' ')}" />`
      : '',
    `  </g>`,
    `  <g id="jigsaw-vertical" fill="none" stroke="#000000" stroke-width="0.2">`,
    verticalPaths.length > 0
      ? `    <path id="jigsaw-v-cuts" d="${verticalPaths.join(' ')}" />`
      : '',
    `  </g>`,
    `  <g id="jigsaw-border" fill="none" stroke="#000000" stroke-width="0.25">`,
    `    <rect id="outer-frame" x="${fmt(pad)}" y="${fmt(pad)}" width="${fmt(width)}" height="${fmt(height)}" />`,
    `  </g>`,
    `</svg>`,
  ]
    .filter((line) => line.length > 0)
    .join('\n');
}

export const jigsawGenerator: PluginGenerator<JigsawParams> = {
  id: 'jigsaw',
  name: 'Jigsaw Puzzle',
  description:
    'Deterministic parametric jigsaw puzzle generator with non-overlapping shared cut lines.',
  category: 'Puzzles & Games',
  params: JIGSAW_PARAMS,
  generate(params): GeneratorResult {
    return {
      svg: generateJigsawSvg(params),
      suggestedFilename: `jigsaw-${params.cols ?? 5}x${params.rows ?? 4}.svg`,
    };
  },
};
