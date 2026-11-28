import type { GeneratorResult, ParamField, PluginGenerator } from '@kmxcnc/plugin-sdk';

export type PatternType = 'grid' | 'hex' | 'concentric' | 'spirograph';

export interface PatternParams extends Record<string, unknown> {
  patternType: PatternType;
  width: number;
  height: number;
  cellSize: number;
  rings: number;
  spiroR: number;
  spiroSmallR: number;
  spiroD: number;
}

export const PATTERN_PARAMS: ParamField[] = [
  {
    name: 'patternType',
    label: 'Pattern Type',
    type: 'select',
    defaultValue: 'hex',
    options: [
      { value: 'grid', label: 'Grid Lattice' },
      { value: 'hex', label: 'Hexagonal Honeycomb' },
      { value: 'concentric', label: 'Concentric Circles' },
      { value: 'spirograph', label: 'Spirograph (Hypotrochoid)' },
    ],
    required: true,
    order: 1,
  },
  {
    name: 'width',
    label: 'Width',
    type: 'number',
    defaultValue: 120,
    unit: 'mm',
    min: 10,
    max: 2000,
    step: 5,
    required: true,
    order: 2,
  },
  {
    name: 'height',
    label: 'Height',
    type: 'number',
    defaultValue: 120,
    unit: 'mm',
    min: 10,
    max: 2000,
    step: 5,
    required: true,
    order: 3,
  },
  {
    name: 'cellSize',
    label: 'Cell / Hex Size',
    type: 'number',
    defaultValue: 15,
    unit: 'mm',
    min: 2,
    max: 200,
    step: 1,
    order: 4,
  },
  {
    name: 'rings',
    label: 'Concentric Rings',
    type: 'number',
    defaultValue: 8,
    min: 1,
    max: 100,
    step: 1,
    order: 5,
  },
  {
    name: 'spiroR',
    label: 'Spirograph Outer R',
    type: 'number',
    defaultValue: 50,
    unit: 'mm',
    min: 5,
    max: 500,
    step: 1,
    order: 6,
  },
  {
    name: 'spiroSmallR',
    label: 'Spirograph Inner r',
    type: 'number',
    defaultValue: 18,
    unit: 'mm',
    min: 2,
    max: 200,
    step: 1,
    order: 7,
  },
  {
    name: 'spiroD',
    label: 'Spirograph Pen Offset d',
    type: 'number',
    defaultValue: 30,
    unit: 'mm',
    min: 1,
    max: 300,
    step: 1,
    order: 8,
  },
];

function fmt(n: number): string {
  return Number(n.toFixed(3)).toString();
}

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return Math.max(1, x);
}

function generateGridContent(width: number, height: number, cellSize: number, pad: number): string {
  const parts: string[] = [];
  const cols = Math.max(1, Math.floor(width / cellSize));
  const rows = Math.max(1, Math.floor(height / cellSize));
  const actualW = cols * cellSize;
  const actualH = rows * cellSize;

  for (let c = 0; c <= cols; c++) {
    const x = pad + c * cellSize;
    parts.push(`M${fmt(x)} ${fmt(pad)} L${fmt(x)} ${fmt(pad + actualH)}`);
  }
  for (let r = 0; r <= rows; r++) {
    const y = pad + r * cellSize;
    parts.push(`M${fmt(pad)} ${fmt(y)} L${fmt(pad + actualW)} ${fmt(y)}`);
  }

  return `    <path id="pattern-grid" d="${parts.join(' ')}" fill="none" stroke="#000000" stroke-width="0.2" />`;
}

function generateHexContent(width: number, height: number, cellSize: number, pad: number): string {
  const r = Math.max(2, cellSize / 2);
  const dx = r * 1.5;
  const dy = r * Math.sqrt(3);
  const cols = Math.max(1, Math.floor((width - r * 2) / dx) + 1);
  const rows = Math.max(1, Math.floor((height - dy) / dy) + 1);

  const hexPaths: string[] = [];
  for (let c = 0; c < cols; c++) {
    for (let row = 0; row < rows; row++) {
      const cx = pad + r + c * dx;
      const cy = pad + dy / 2 + row * dy + (c % 2 === 1 ? dy / 2 : 0);
      if (cx + r > pad + width + 0.01 || cy + dy / 2 > pad + height + 0.01) {
        continue;
      }
      const verts: string[] = [];
      for (let k = 0; k < 6; k++) {
        const angle = (Math.PI / 3) * k;
        const vx = cx + r * Math.cos(angle);
        const vy = cy + r * Math.sin(angle);
        verts.push(`${k === 0 ? 'M' : 'L'}${fmt(vx)} ${fmt(vy)}`);
      }
      verts.push('Z');
      hexPaths.push(verts.join(' '));
    }
  }

  return `    <path id="pattern-hex" d="${hexPaths.join(' ')}" fill="none" stroke="#000000" stroke-width="0.2" />`;
}

function generateConcentricContent(
  width: number,
  height: number,
  rings: number,
  pad: number,
): string {
  const cx = pad + width / 2;
  const cy = pad + height / 2;
  const maxR = Math.min(width, height) / 2;
  const circles: string[] = [];

  for (let i = 1; i <= rings; i++) {
    const r = (maxR * i) / rings;
    circles.push(
      `    <circle id="ring-${i}" cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(r)}" fill="none" stroke="#000000" stroke-width="0.2" />`,
    );
  }
  return circles.join('\n');
}

function generateSpirographContent(
  width: number,
  height: number,
  R: number,
  r: number,
  d: number,
  pad: number,
): string {
  const cx = pad + width / 2;
  const cy = pad + height / 2;
  const maxExtent = Math.abs(R - r) + Math.abs(d);
  const maxAllowed = Math.min(width, height) / 2;
  const scale = maxExtent > maxAllowed && maxExtent > 0 ? maxAllowed / maxExtent : 1;

  const revolutions = Math.min(24, Math.round(r / gcd(R, r)));
  const totalAngle = revolutions * Math.PI * 2;
  const steps = Math.max(180, revolutions * 90);
  const diff = R - r;

  const commands: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (totalAngle * i) / steps;
    const x = cx + scale * (diff * Math.cos(t) + d * Math.cos((diff / r) * t));
    const y = cy + scale * (diff * Math.sin(t) - d * Math.sin((diff / r) * t));
    commands.push(`${i === 0 ? 'M' : 'L'}${fmt(x)} ${fmt(y)}`);
  }

  return `    <path id="pattern-spirograph" d="${commands.join(' ')}" fill="none" stroke="#000000" stroke-width="0.2" />`;
}

export function generatePatternSvg(rawParams: Partial<PatternParams> = {}): string {
  const patternType = (rawParams.patternType ?? 'hex') as PatternType;
  const width = Math.max(10, Number(rawParams.width ?? 120));
  const height = Math.max(10, Number(rawParams.height ?? 120));
  const cellSize = Math.max(2, Number(rawParams.cellSize ?? 15));
  const rings = Math.max(1, Math.floor(Number(rawParams.rings ?? 8)));
  const spiroR = Math.max(5, Number(rawParams.spiroR ?? 50));
  const spiroSmallR = Math.max(2, Number(rawParams.spiroSmallR ?? 18));
  const spiroD = Math.max(1, Number(rawParams.spiroD ?? 30));

  const pad = 2;
  const totalW = width + pad * 2;
  const totalH = height + pad * 2;

  let body: string;
  switch (patternType) {
    case 'grid':
      body = generateGridContent(width, height, cellSize, pad);
      break;
    case 'concentric':
      body = generateConcentricContent(width, height, rings, pad);
      break;
    case 'spirograph':
      body = generateSpirographContent(width, height, spiroR, spiroSmallR, spiroD, pad);
      break;
    case 'hex':
    default:
      body = generateHexContent(width, height, cellSize, pad);
      break;
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(totalW)}mm" height="${fmt(totalH)}mm" viewBox="0 0 ${fmt(totalW)} ${fmt(totalH)}">`,
    `  <g id="pattern-${patternType}">`,
    body,
    `  </g>`,
    `</svg>`,
  ].join('\n');
}

export const patternGenerator: PluginGenerator<PatternParams> = {
  id: 'pattern',
  name: 'Geometric Pattern',
  description: 'Parametric geometric & lattice pattern generator (grid, hex, concentric circles, spirograph).',
  category: 'Patterns',
  params: PATTERN_PARAMS,
  generate(params): GeneratorResult {
    return {
      svg: generatePatternSvg(params),
      suggestedFilename: `pattern-${params.patternType ?? 'hex'}.svg`,
    };
  },
};
