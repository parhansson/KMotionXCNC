import { describe, expect, it, vi } from 'vitest';
import { getDefaultParams, PluginRegistry } from './registry.js';
import type { KmxPlugin } from './types.js';

describe('PluginRegistry', () => {
  const universalPlugin: KmxPlugin = {
    id: 'generators',
    name: 'Generators',
    version: '1.0.0',
    routes: [{ id: 'gen-route', path: '/generators', label: 'Generators', order: 20 }],
    generators: [
      {
        id: 'box',
        name: 'Box',
        params: [
          { name: 'width', label: 'Width', type: 'number', defaultValue: 50 },
          { name: 'lid', label: 'Lid', type: 'boolean', defaultValue: true },
        ],
        generate: () => ({ svg: '<svg></svg>' }),
      },
    ],
  };

  const laserPlugin: KmxPlugin = {
    id: 'laser',
    name: 'Laser',
    version: '1.0.0',
    capabilities: ['laser'],
    routes: [{ id: 'laser-route', path: '/laser', label: 'Laser', order: 10 }],
    panels: [{ id: 'ppi', title: 'PPI Calculator' }],
    postProcessors: [
      {
        id: 'laser-ppi',
        name: 'Laser PPI',
        process: () => 'M100 P1000 Q100\n',
      },
    ],
  };

  const kflopPlugin: KmxPlugin = {
    id: 'kflop',
    name: 'KFLOP',
    version: '1.0.0',
    capabilities: ['kflop'],
    settingsSections: [{ id: 'motion', title: 'Motion Params', order: 5 }],
  };

  it('registers, lists, unregisters plugins and notifies subscribers', () => {
    const registry = new PluginRegistry();
    const listener = vi.fn();
    const unsubscribe = registry.subscribe(listener);

    registry.register(universalPlugin);
    registry.register(laserPlugin);

    expect(registry.hasPlugin('generators')).toBe(true);
    expect(registry.getPlugin('laser')?.name).toBe('Laser');
    expect(registry.listPlugins()).toHaveLength(2);
    expect(listener).toHaveBeenCalledTimes(2);

    expect(registry.unregister('laser')).toBe(true);
    expect(registry.unregister('nonexistent')).toBe(false);
    expect(registry.listPlugins()).toHaveLength(1);
    expect(listener).toHaveBeenCalledTimes(3);

    unsubscribe();
    registry.register(kflopPlugin);
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('rejects empty plugin ids', () => {
    const registry = new PluginRegistry();
    expect(() =>
      registry.register({ id: '   ', name: 'Bad', version: '0.0.1' }),
    ).toThrow();
  });

  it('filters by capabilities and enabledPluginIds', () => {
    const registry = new PluginRegistry();
    registry.register(universalPlugin);
    registry.register(laserPlugin);
    registry.register(kflopPlugin);

    // Mill machine without laser capability
    const millPlugins = registry.listPlugins({ capabilities: ['kflop'] });
    expect(millPlugins.map((p) => p.id)).toEqual(['generators', 'kflop']);

    // Laser machine with both capabilities
    const laserRoutes = registry.getRoutes({ capabilities: ['kflop', 'laser'] });
    expect(laserRoutes.map((r) => r.id)).toEqual(['laser-route', 'gen-route']); // sorted by order

    // Restricted enabledPluginIds
    const onlyGenerators = registry.listPlugins({
      capabilities: ['kflop', 'laser'],
      enabledPluginIds: ['generators'],
    });
    expect(onlyGenerators.map((p) => p.id)).toEqual(['generators']);

    expect(registry.getPanels({ capabilities: ['laser'] })).toHaveLength(1);
    expect(registry.getPanels({ capabilities: ['kflop'] })).toHaveLength(0);
    expect(registry.getGenerators({ capabilities: [] })).toHaveLength(1);
    expect(registry.getPostProcessors({ capabilities: ['laser'] })).toHaveLength(1);
    expect(registry.getSettingsSections({ capabilities: ['kflop'] })).toHaveLength(1);
  });

  it('extracts default params from ParamField schemas', () => {
    const defaults = getDefaultParams(universalPlugin.generators![0]!.params);
    expect(defaults).toEqual({ width: 50, lid: true });
  });
});
