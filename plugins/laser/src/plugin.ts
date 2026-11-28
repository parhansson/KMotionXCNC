import type { KmxPlugin } from '@kmxcnc/plugin-sdk';
import { laserPostProcessor } from './laser-postprocessor.js';

export const laserPlugin: KmxPlugin = {
  id: 'laser',
  name: 'Laser Cutter & PPI Tools',
  version: '0.1.0',
  description:
    'Laser PPI calculator, material preset library, and M100 PPI laser G-code postprocessor.',
  capabilities: ['laser'],
  routes: [
    {
      id: 'laser-tools',
      path: '/laser',
      label: 'Laser Tools',
      icon: 'zap',
      order: 25,
    },
  ],
  panels: [
    {
      id: 'laser-ppi-calculator',
      title: 'Laser PPI Calculator',
      icon: 'calculator',
      defaultArea: 'right',
    },
    {
      id: 'laser-materials',
      title: 'Laser Material Presets',
      icon: 'layers',
      defaultArea: 'right',
    },
  ],
  postProcessors: [laserPostProcessor],
};
