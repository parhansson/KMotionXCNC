import type { KmxPlugin } from '@kmxcnc/plugin-sdk';
import { MOTION_PARAMS_AXIS_FIELDS, TPLANNER_FIELDS } from './actions.js';

export const kflopPlugin: KmxPlugin = {
  id: 'kflop',
  name: 'KFLOP / Kogna Hardware',
  version: '0.1.0',
  description:
    'Dynomotion KFLOP & Kogna machine configuration, C-program editor, thread monitor, and digital/analog I/O diagnostics.',
  capabilities: ['kflop'],
  routes: [
    {
      id: 'kflop-settings',
      path: '/kflop/settings',
      label: 'Machine Settings',
      icon: 'sliders',
      order: 30,
    },
    {
      id: 'kflop-ccode',
      path: '/kflop/ccode',
      label: 'C-Programs',
      icon: 'code',
      order: 40,
    },
    {
      id: 'kflop-diagnostics',
      path: '/kflop/diagnostics',
      label: 'Hardware Diagnostics',
      icon: 'cpu',
      order: 50,
    },
  ],
  panels: [
    {
      id: 'kflop-digital-io',
      title: 'KFLOP Digital I/O (JP4–JP7)',
      icon: 'circuit-board',
      defaultArea: 'bottom',
    },
    {
      id: 'kflop-threads',
      title: 'KFLOP Threads (1–7)',
      icon: 'activity',
      defaultArea: 'right',
    },
    {
      id: 'kflop-analog-io',
      title: 'ADC / DAC / PWM Monitor',
      icon: 'gauge',
      defaultArea: 'bottom',
    },
  ],
  settingsSections: [
    {
      id: 'kflop-motion-params',
      title: 'Axis Motion Parameters (MOTION_PARAMS)',
      description: 'Per-axis counts/unit, velocity, acceleration, jerk, rotary config, and soft limits for axes X–V.',
      order: 10,
      fields: [...MOTION_PARAMS_AXIS_FIELDS],
    },
    {
      id: 'kflop-tplanner',
      title: 'Trajectory Planner',
      description: 'Break angle, corner/collinear tolerance, lookahead, and 3rd-order planner flags.',
      order: 20,
      fields: [...TPLANNER_FIELDS],
    },
    {
      id: 'kflop-mcodes',
      title: 'M-Codes & User Buttons',
      description: 'Configure standard M0–M9/S, special actions, extended M100–M119, and 10 custom user buttons.',
      order: 30,
    },
  ],
};
