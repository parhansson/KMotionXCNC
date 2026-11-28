import type { KmxPlugin, PluginGenerator } from '@kmxcnc/plugin-sdk';
import { cipherWheelGenerator } from './cipher-wheel.js';
import { jigsawGenerator } from './jigsaw.js';
import { mitreBoxGenerator } from './mitre-box.js';
import { patternGenerator } from './pattern.js';
import { textPathGenerator } from './text-path.js';

export const ALL_GENERATORS: PluginGenerator[] = [
  mitreBoxGenerator as PluginGenerator,
  textPathGenerator as PluginGenerator,
  jigsawGenerator as PluginGenerator,
  patternGenerator as PluginGenerator,
  cipherWheelGenerator as PluginGenerator,
];

/**
 * Universal parametric CAD/CAM generators plugin (no machine capability restriction).
 */
export const generatorsPlugin: KmxPlugin = {
  id: 'generators',
  name: 'Parametric CAD/CAM Generators',
  version: '0.1.0',
  description:
    'Parametric SVG generators for Mitre Box, Text Path, Jigsaw Puzzle, Geometric Patterns, and Cipher Wheel.',
  routes: [
    {
      id: 'generators',
      path: '/generators',
      label: 'Generators',
      icon: 'shapes',
      order: 20,
    },
  ],
  generators: ALL_GENERATORS,
};
