import { describe, expect, it } from 'vitest';
import { getDefaultParams } from '@kmxcnc/plugin-sdk';
import {
  ALL_GENERATORS,
  cipherWheelGenerator,
  generateCipherWheelSvg,
  generateJigsawSvg,
  generateMitreBoxSvg,
  generatePatternSvg,
  generateTextPathSvg,
  generatorsPlugin,
  jigsawGenerator,
  mitreBoxGenerator,
  patternGenerator,
  textPathGenerator,
} from './index.js';

function assertValidSvg(svg: string): void {
  expect(svg).toMatch(/^<svg\s[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  expect(svg).toContain('viewBox="');
  expect(svg.trim().endsWith('</svg>')).toBe(true);
  expect(svg).not.toContain('NaN');
  expect(svg).not.toContain('Infinity');
}

describe('Parametric SVG Generators plugin', () => {
  it('registers all 5 generators without capability restrictions', () => {
    expect(generatorsPlugin.capabilities).toBeUndefined();
    expect(ALL_GENERATORS.map((g) => g.id)).toEqual([
      'mitre-box',
      'text-path',
      'jigsaw',
      'pattern',
      'cipher-wheel',
    ]);
  });

  it('generates valid SVG for every generator using its default ParamField values', async () => {
    for (const generator of ALL_GENERATORS) {
      const defaults = getDefaultParams(generator.params);
      const result = await generator.generate(defaults);
      assertValidSvg(result.svg);
    }
  });

  it('Mitre Box supports lid toggle and kerf compensation', () => {
    const withLid = generateMitreBoxSvg({
      width: 80,
      depth: 60,
      height: 50,
      materialThickness: 3,
      tabWidth: 10,
      kerf: 0.15,
      lid: true,
    });
    const withoutLid = generateMitreBoxSvg({
      width: 80,
      depth: 60,
      height: 50,
      materialThickness: 3,
      tabWidth: 10,
      kerf: 0.15,
      lid: false,
    });

    assertValidSvg(withLid);
    assertValidSvg(withoutLid);
    expect(withLid).toContain('id="panel-lid"');
    expect(withoutLid).not.toContain('id="panel-lid"');
    expect(mitreBoxGenerator.params.length).toBeGreaterThanOrEqual(6);
  });

  it('Text Path generates built-in vector stroke SVG without a font buffer', () => {
    const svg = generateTextPathSvg({
      text: 'KMXCNC\n123 ÅÄÖ',
      fontSize: 24,
      letterSpacing: 2,
      lineHeight: 1.3,
    });
    assertValidSvg(svg);
    expect(svg).toContain('<path');
    expect(svg).toContain('M');
    expect(textPathGenerator.id).toBe('text-path');
  });

  it('Jigsaw generator is deterministic for the same seed and differs across seeds', () => {
    const a1 = generateJigsawSvg({ width: 180, height: 120, rows: 3, cols: 4, tabSize: 20, seed: 123 });
    const a2 = generateJigsawSvg({ width: 180, height: 120, rows: 3, cols: 4, tabSize: 20, seed: 123 });
    const b = generateJigsawSvg({ width: 180, height: 120, rows: 3, cols: 4, tabSize: 20, seed: 999 });

    assertValidSvg(a1);
    expect(a1).toBe(a2);
    expect(a1).not.toBe(b);
    expect(a1).toContain('<rect id="outer-frame"');
    expect(jigsawGenerator.id).toBe('jigsaw');
  });

  it('Pattern generator supports grid, hex, concentric, and spirograph modes', () => {
    for (const patternType of ['grid', 'hex', 'concentric', 'spirograph'] as const) {
      const svg = generatePatternSvg({ patternType, width: 100, height: 100, cellSize: 12, rings: 5 });
      assertValidSvg(svg);
      expect(svg).toContain(`id="pattern-${patternType}"`);
    }
    expect(patternGenerator.id).toBe('pattern');
  });

  it('Cipher Wheel supports dial rings and key cutout mode', () => {
    const dial = generateCipherWheelSvg({
      outerRadius: 75,
      innerRadius: 40,
      alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      rings: 2,
      includeKeyCutout: false,
    });
    const key = generateCipherWheelSvg({
      outerRadius: 75,
      innerRadius: 40,
      alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      rings: 2,
      includeKeyCutout: true,
    });

    assertValidSvg(dial);
    assertValidSvg(key);
    expect(dial).toContain('id="cipher-spokes"');
    expect(dial).toContain('>A</text>');
    expect(key).toContain('id="cipher-key-cutout"');
    expect(cipherWheelGenerator.id).toBe('cipher-wheel');
  });
});
