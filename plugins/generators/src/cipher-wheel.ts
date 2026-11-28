import type { GeneratorResult, ParamField, PluginGenerator } from '@kmxcnc/plugin-sdk';

export interface CipherWheelParams extends Record<string, unknown> {
  outerRadius: number;
  innerRadius: number;
  alphabet: string;
  rings: number;
  includeKeyCutout: boolean;
}

export const CIPHER_WHEEL_PARAMS: ParamField[] = [
  {
    name: 'outerRadius',
    label: 'Outer Radius',
    type: 'number',
    defaultValue: 80,
    unit: 'mm',
    min: 15,
    max: 500,
    step: 1,
    required: true,
    order: 1,
  },
  {
    name: 'innerRadius',
    label: 'Inner Radius',
    type: 'number',
    defaultValue: 45,
    unit: 'mm',
    min: 5,
    max: 450,
    step: 1,
    required: true,
    order: 2,
  },
  {
    name: 'alphabet',
    label: 'Alphabet / Symbols',
    type: 'string',
    defaultValue: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    required: true,
    order: 3,
  },
  {
    name: 'rings',
    label: 'Number of Rings',
    type: 'number',
    defaultValue: 2,
    min: 1,
    max: 5,
    step: 1,
    order: 4,
  },
  {
    name: 'includeKeyCutout',
    label: 'Key Sector Cutout Mode',
    type: 'boolean',
    defaultValue: false,
    order: 5,
  },
];

function fmt(n: number): string {
  return Number(n.toFixed(3)).toString();
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function polarToCartesian(
  cx: number,
  cy: number,
  radius: number,
  angleDeg: number,
): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad),
  };
}

function describeArc(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
  lineTo = false,
): string {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArcFlag = Math.abs(endAngle - startAngle) <= 180 ? '0' : '1';
  const sweepFlag = endAngle >= startAngle ? '0' : '1';
  return `${lineTo ? 'L' : 'M'}${fmt(start.x)} ${fmt(start.y)} A${fmt(radius)} ${fmt(radius)} 0 ${largeArcFlag} ${sweepFlag} ${fmt(end.x)} ${fmt(end.y)}`;
}

export function generateCipherWheelSvg(rawParams: Partial<CipherWheelParams> = {}): string {
  const outerRadius = Math.max(15, Number(rawParams.outerRadius ?? 80));
  const rawInner = Math.max(5, Number(rawParams.innerRadius ?? 45));
  const innerRadius = Math.min(rawInner, outerRadius - 8);
  const alphabetStr = String(rawParams.alphabet ?? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ').trim();
  const letters = Array.from(alphabetStr.length >= 2 ? alphabetStr : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ');
  const rings = Math.max(1, Math.min(5, Math.floor(Number(rawParams.rings ?? 2))));
  const includeKeyCutout = Boolean(rawParams.includeKeyCutout ?? false);

  const pad = 4;
  const cx = outerRadius + pad;
  const cy = outerRadius + pad;
  const size = (outerRadius + pad) * 2;
  const slices = letters.length;
  const sliceAngle = 360 / slices;
  const ringStep = (outerRadius - innerRadius) / rings;

  const elements: string[] = [];

  if (includeKeyCutout) {
    const outerArc = describeArc(cx, cy, outerRadius, sliceAngle, 360, false);
    const innerArc = describeArc(cx, cy, innerRadius, 360, sliceAngle, true);
    elements.push(
      `    <path id="cipher-key-cutout" d="${outerArc} ${innerArc} Z" fill="none" stroke="#000000" stroke-width="0.25" />`,
    );
  } else {
    // Ring circles
    for (let rIdx = 0; rIdx <= rings; rIdx++) {
      const r = innerRadius + rIdx * ringStep;
      elements.push(
        `    <circle id="cipher-ring-${rIdx}" cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(r)}" fill="none" stroke="#000000" stroke-width="0.2" />`,
      );
    }

    // Radial spokes
    const spokeParts: string[] = [];
    for (let i = 0; i < slices; i++) {
      const angle = i * sliceAngle;
      const pIn = polarToCartesian(cx, cy, innerRadius, angle);
      const pOut = polarToCartesian(cx, cy, outerRadius, angle);
      spokeParts.push(`M${fmt(pIn.x)} ${fmt(pIn.y)} L${fmt(pOut.x)} ${fmt(pOut.y)}`);
    }
    elements.push(
      `    <path id="cipher-spokes" d="${spokeParts.join(' ')}" fill="none" stroke="#446688" stroke-width="0.15" />`,
    );

    // Ring labels (outer ring = letters, inner rings = shifted indices / numbers)
    for (let rIdx = 0; rIdx < rings; rIdx++) {
      const labelRadius = outerRadius - (rIdx + 0.5) * ringStep;
      const fontSize = Math.max(3, Math.min(ringStep * 0.55, (2 * Math.PI * labelRadius) / (slices * 1.4)));
      for (let i = 0; i < slices; i++) {
        const textAngle = i * sliceAngle + sliceAngle / 2;
        const pos = polarToCartesian(cx, cy, labelRadius, textAngle);
        const label =
          rIdx === 0
            ? letters[i]!
            : String(((i + rIdx * 7) % slices) + 1);
        elements.push(
          `    <text x="0" y="0" font-size="${fmt(fontSize)}" font-family="sans-serif" dominant-baseline="middle" text-anchor="middle" transform="translate(${fmt(pos.x)},${fmt(pos.y)}) rotate(${fmt(textAngle)})">${escapeXml(label)}</text>`,
        );
      }
    }
  }

  // Center pivot hole & outer perimeter cut
  elements.push(
    `    <circle id="cipher-pivot" cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(Math.max(2, Math.min(4, innerRadius * 0.15)))}" fill="none" stroke="#000000" stroke-width="0.25" />`,
  );
  elements.push(
    `    <circle id="cipher-outer-cut" cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(outerRadius)}" fill="none" stroke="#000000" stroke-width="0.3" />`,
  );

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(size)}mm" height="${fmt(size)}mm" viewBox="0 0 ${fmt(size)} ${fmt(size)}">`,
    `  <g id="cipher-wheel">`,
    ...elements,
    `  </g>`,
    `</svg>`,
  ].join('\n');
}

export const cipherWheelGenerator: PluginGenerator<CipherWheelParams> = {
  id: 'cipher-wheel',
  name: 'Cipher Wheel',
  description: 'Parametric circular cipher wheel with customizable alphabet, rings, and optional key cutout.',
  category: 'Puzzles & Games',
  params: CIPHER_WHEEL_PARAMS,
  generate(params): GeneratorResult {
    return {
      svg: generateCipherWheelSvg(params),
      suggestedFilename: `cipher-wheel-r${params.outerRadius ?? 80}.svg`,
    };
  },
};
