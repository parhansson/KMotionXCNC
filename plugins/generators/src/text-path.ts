import opentype from 'opentype.js';
import type {
  GeneratorOptions,
  GeneratorResult,
  ParamField,
  PluginGenerator,
} from '@kmxcnc/plugin-sdk';

export interface TextPathParams extends Record<string, unknown> {
  text: string;
  fontSize: number;
  letterSpacing: number;
  lineHeight: number;
  fontStyle: string;
}

export const TEXT_PATH_PARAMS: ParamField[] = [
  {
    name: 'text',
    label: 'Text',
    type: 'textarea',
    defaultValue: 'KMXCNC',
    placeholder: 'Enter text to vectorize',
    required: true,
    order: 1,
  },
  {
    name: 'fontSize',
    label: 'Font Size',
    type: 'number',
    defaultValue: 20,
    unit: 'mm',
    min: 2,
    max: 500,
    step: 1,
    required: true,
    order: 2,
  },
  {
    name: 'letterSpacing',
    label: 'Letter Spacing',
    type: 'number',
    defaultValue: 2,
    unit: 'mm',
    min: 0,
    max: 100,
    step: 0.5,
    order: 3,
  },
  {
    name: 'lineHeight',
    label: 'Line Height Multiplier',
    type: 'number',
    defaultValue: 1.35,
    min: 0.8,
    max: 3,
    step: 0.05,
    order: 4,
  },
  {
    name: 'fontStyle',
    label: 'Font Mode',
    type: 'select',
    defaultValue: 'stroke',
    options: [
      { value: 'stroke', label: 'Built-in Single-Line Vector Stroke' },
      { value: 'opentype', label: 'Loaded OpenType Font (with fallback)' },
    ],
    order: 5,
  },
];

/**
 * Minimal Hershey-inspired single-line vector glyphs on a normalized 0..6 (X) x 0..10 (Y, top=0, bottom=10) grid.
 * Each glyph is a list of polylines (arrays of [x, y] coordinates).
 */
type GlyphStrokes = ReadonlyArray<ReadonlyArray<readonly [number, number]>>;

const STROKE_GLYPHS: Record<string, GlyphStrokes> = {
  A: [[[0, 10], [3, 0], [6, 10]], [[1, 6.5], [5, 6.5]]],
  B: [[[0, 10], [0, 0], [4, 0], [5.5, 1.5], [5.5, 3.5], [4, 5], [0, 5]], [[4, 5], [6, 6.5], [6, 8.5], [4, 10], [0, 10]]],
  C: [[[6, 2], [4.5, 0], [1.5, 0], [0, 2], [0, 8], [1.5, 10], [4.5, 10], [6, 8]]],
  D: [[[0, 10], [0, 0], [3.5, 0], [6, 2.5], [6, 7.5], [3.5, 10], [0, 10]]],
  E: [[[6, 0], [0, 0], [0, 10], [6, 10]], [[0, 5], [4.5, 5]]],
  F: [[[6, 0], [0, 0], [0, 10]], [[0, 5], [4.5, 5]]],
  G: [[[6, 2], [4.5, 0], [1.5, 0], [0, 2], [0, 8], [1.5, 10], [4.5, 10], [6, 8], [6, 5.5], [3.5, 5.5]]],
  H: [[[0, 0], [0, 10]], [[6, 0], [6, 10]], [[0, 5], [6, 5]]],
  I: [[[1.5, 0], [4.5, 0]], [[3, 0], [3, 10]], [[1.5, 10], [4.5, 10]]],
  J: [[[1, 0], [5.5, 0]], [[4.5, 0], [4.5, 8], [3, 10], [1, 10], [0, 8.5]]],
  K: [[[0, 0], [0, 10]], [[6, 0], [0, 5.5]], [[1.8, 4], [6, 10]]],
  L: [[[0, 0], [0, 10], [6, 10]]],
  M: [[[0, 10], [0, 0], [3, 5.5], [6, 0], [6, 10]]],
  N: [[[0, 10], [0, 0], [6, 10], [6, 0]]],
  O: [[[1.5, 0], [4.5, 0], [6, 2], [6, 8], [4.5, 10], [1.5, 10], [0, 8], [0, 2], [1.5, 0]]],
  P: [[[0, 10], [0, 0], [4.5, 0], [6, 1.5], [6, 4], [4.5, 5.5], [0, 5.5]]],
  Q: [[[1.5, 0], [4.5, 0], [6, 2], [6, 8], [4.5, 10], [1.5, 10], [0, 8], [0, 2], [1.5, 0]], [[3.5, 7], [6, 10.5]]],
  R: [[[0, 10], [0, 0], [4.5, 0], [6, 1.5], [6, 4], [4.5, 5.5], [0, 5.5]], [[3, 5.5], [6, 10]]],
  S: [[[6, 1.8], [4.5, 0], [1.5, 0], [0, 1.8], [0, 3.5], [1.5, 4.8], [4.5, 5.4], [6, 6.8], [6, 8.5], [4.5, 10], [1.5, 10], [0, 8.2]]],
  T: [[[0, 0], [6, 0]], [[3, 0], [3, 10]]],
  U: [[[0, 0], [0, 8], [1.5, 10], [4.5, 10], [6, 8], [6, 0]]],
  V: [[[0, 0], [3, 10], [6, 0]]],
  W: [[[0, 0], [1.2, 10], [3, 4.5], [4.8, 10], [6, 0]]],
  X: [[[0, 0], [6, 10]], [[6, 0], [0, 10]]],
  Y: [[[0, 0], [3, 5], [6, 0]], [[3, 5], [3, 10]]],
  Z: [[[0, 0], [6, 0], [0, 10], [6, 10]]],
  Å: [[[0, 10], [3, 1], [6, 10]], [[1, 6.8], [5, 6.8]], [[2.3, -1.2], [3.7, -1.2], [3.7, 0.2], [2.3, 0.2], [2.3, -1.2]]],
  Ä: [[[0, 10], [3, 1], [6, 10]], [[1, 6.8], [5, 6.8]], [[1.5, -1], [1.5, 0]], [[4.5, -1], [4.5, 0]]],
  Ö: [[[1.5, 1], [4.5, 1], [6, 2.5], [6, 8.5], [4.5, 10], [1.5, 10], [0, 8.5], [0, 2.5], [1.5, 1]], [[1.5, -1], [1.5, 0]], [[4.5, -1], [4.5, 0]]],
  '0': [[[1.5, 0], [4.5, 0], [6, 2], [6, 8], [4.5, 10], [1.5, 10], [0, 8], [0, 2], [1.5, 0]], [[1, 8.5], [5, 1.5]]],
  '1': [[[1.5, 2], [3.5, 0], [3.5, 10]], [[1.5, 10], [5.5, 10]]],
  '2': [[[0, 2], [1.5, 0], [4.5, 0], [6, 2], [6, 4], [0, 10], [6, 10]]],
  '3': [[[0, 1.5], [1.5, 0], [4.5, 0], [6, 1.8], [6, 3.5], [4.2, 5], [2, 5]], [[4.2, 5], [6, 6.5], [6, 8.2], [4.5, 10], [1.5, 10], [0, 8.5]]],
  '4': [[[4.5, 10], [4.5, 0], [0, 6.5], [6, 6.5]]],
  '5': [[[6, 0], [0.5, 0], [0.2, 4.5], [4.5, 4.5], [6, 6], [6, 8.2], [4.5, 10], [1.5, 10], [0, 8.5]]],
  '6': [[[5.5, 1.5], [4, 0], [1.5, 0], [0, 2], [0, 8], [1.5, 10], [4.5, 10], [6, 8.2], [6, 6], [4.5, 4.5], [1.5, 4.5], [0, 6]]],
  '7': [[[0, 0], [6, 0], [2, 10]]],
  '8': [[[1.5, 5], [0, 3.5], [0, 1.5], [1.5, 0], [4.5, 0], [6, 1.5], [6, 3.5], [4.5, 5], [1.5, 5], [0, 6.5], [0, 8.5], [1.5, 10], [4.5, 10], [6, 8.5], [6, 6.5], [4.5, 5]]],
  '9': [[[6, 4], [4.5, 5.5], [1.5, 5.5], [0, 4], [0, 1.8], [1.5, 0], [4.5, 0], [6, 1.8], [6, 8], [4.5, 10], [1.5, 10], [0.5, 8.8]]],
  '-': [[[1, 5], [5, 5]]],
  '_': [[[0, 10], [6, 10]]],
  '.': [[[2.5, 9], [3.5, 9], [3.5, 10], [2.5, 10], [2.5, 9]]],
  ',': [[[3.5, 9], [2.5, 11]]],
  ':': [[[3, 3], [3, 4]], [[3, 8], [3, 9]]],
  '!': [[[3, 0], [3, 7]], [[3, 9], [3, 10]]],
  '?': [[[0.5, 2], [2, 0], [4.5, 0], [6, 1.5], [6, 3.5], [3, 5.5], [3, 7]], [[3, 9], [3, 10]]],
  '/': [[[0.5, 10], [5.5, 0]]],
  '+': [[[3, 2], [3, 8]], [[0.5, 5], [5.5, 5]]],
  ' ': [],
};

function fmt(n: number): string {
  return Number(n.toFixed(3)).toString();
}

function buildStrokeSvg(
  text: string,
  fontSize: number,
  letterSpacing: number,
  lineHeight: number,
): string {
  const lines = text.split(/\r?\n/);
  const scale = fontSize / 10;
  const charW = 6 * scale;
  const stepX = charW + letterSpacing;
  const stepY = fontSize * lineHeight;
  const pad = Math.max(2, fontSize * 0.25);

  let maxLineChars = 1;
  for (const line of lines) {
    maxLineChars = Math.max(maxLineChars, line.length);
  }

  const totalW = pad * 2 + maxLineChars * stepX;
  const totalH = pad * 2 + Math.max(1, lines.length) * stepY;

  const pathParts: string[] = [];

  lines.forEach((line, lineIdx) => {
    const baseY = pad + lineIdx * stepY;
    Array.from(line).forEach((rawChar, charIdx) => {
      const upper = rawChar.toUpperCase();
      const strokes = STROKE_GLYPHS[upper] ?? STROKE_GLYPHS['?'] ?? [];
      const baseX = pad + charIdx * stepX;
      for (const poly of strokes) {
        if (poly.length < 2) continue;
        const cmd = poly
          .map(([gx, gy], ptIdx) => {
            const x = baseX + gx * scale;
            const y = baseY + gy * scale;
            return `${ptIdx === 0 ? 'M' : 'L'}${fmt(x)} ${fmt(y)}`;
          })
          .join(' ');
        pathParts.push(cmd);
      }
    });
  });

  const dAttr = pathParts.join(' ');

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(totalW)}mm" height="${fmt(totalH)}mm" viewBox="0 0 ${fmt(totalW)} ${fmt(totalH)}">`,
    `  <g id="text-path">`,
    `    <path id="text-strokes" d="${dAttr}" fill="none" stroke="#000000" stroke-width="0.25" stroke-linecap="round" stroke-linejoin="round" />`,
    `  </g>`,
    `</svg>`,
  ].join('\n');
}

function buildOpenTypeSvg(
  text: string,
  fontSize: number,
  letterSpacing: number,
  lineHeight: number,
  fontBuffer: ArrayBuffer,
): string {
  const font = opentype.parse(fontBuffer);
  const lines = text.split(/\r?\n/);
  const pad = Math.max(2, fontSize * 0.25);
  const stepY = fontSize * lineHeight;

  const pathElements: string[] = [];
  let maxX = pad * 2 + fontSize;
  let maxY = pad * 2 + fontSize;

  lines.forEach((line, idx) => {
    const baselineY = pad + fontSize + idx * stepY;
    const path = font.getPath(line, pad, baselineY, fontSize, {
      letterSpacing: letterSpacing / Math.max(1, fontSize),
    });
    const bbox = path.getBoundingBox();
    maxX = Math.max(maxX, bbox.x2 + pad);
    maxY = Math.max(maxY, bbox.y2 + pad);
    const d = path.toPathData(3);
    if (d.trim().length > 0) {
      pathElements.push(
        `    <path id="text-line-${idx + 1}" d="${d}" fill="none" stroke="#000000" stroke-width="0.2" />`,
      );
    }
  });

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(maxX)}mm" height="${fmt(maxY)}mm" viewBox="0 0 ${fmt(maxX)} ${fmt(maxY)}">`,
    `  <g id="text-path">`,
    ...pathElements,
    `  </g>`,
    `</svg>`,
  ].join('\n');
}

export function generateTextPathSvg(
  rawParams: Partial<TextPathParams> = {},
  options?: GeneratorOptions,
): string {
  const text = String(rawParams.text ?? 'KMXCNC');
  const fontSize = Math.max(2, Number(rawParams.fontSize ?? 20));
  const letterSpacing = Math.max(0, Number(rawParams.letterSpacing ?? 2));
  const lineHeight = Math.max(0.8, Number(rawParams.lineHeight ?? 1.35));

  if (options?.fontBuffer && options.fontBuffer.byteLength > 0) {
    return buildOpenTypeSvg(text, fontSize, letterSpacing, lineHeight, options.fontBuffer);
  }
  return buildStrokeSvg(text, fontSize, letterSpacing, lineHeight);
}

export const textPathGenerator: PluginGenerator<TextPathParams> = {
  id: 'text-path',
  name: 'Text Path',
  description:
    'Vector text SVG generator with built-in single-line stroke font and OpenType (.ttf/.otf) path extraction.',
  category: 'Typography',
  params: TEXT_PATH_PARAMS,
  generate(params, options): GeneratorResult {
    return {
      svg: generateTextPathSvg(params, options),
      suggestedFilename: 'text-path.svg',
    };
  },
};
