import type {
  FormFieldSchema,
  KmxPlugin,
  PluginFilterOptions,
  PluginGenerator,
  PluginPanel,
  PluginPostProcessor,
  PluginRoute,
  PluginSettingsSection,
} from './types.js';

export type WithPluginId<T> = T & { pluginId: string };

/**
 * Extracts a default parameter map from a declarative FormFieldSchema / ParamField array.
 */
export function getDefaultParams(
  fields: readonly FormFieldSchema[],
): Record<string, number | string | boolean> {
  const result: Record<string, number | string | boolean> = {};
  for (const field of fields) {
    result[field.name] = field.defaultValue;
  }
  return result;
}

/**
 * Framework-agnostic registry for KmxPlugin instances with capability & enablement filtering.
 */
export class PluginRegistry {
  private readonly plugins = new Map<string, KmxPlugin>();
  private readonly listeners = new Set<() => void>();

  register(plugin: KmxPlugin): void {
    if (!plugin.id.trim()) {
      throw new Error('Plugin id must be a non-empty string');
    }
    this.plugins.set(plugin.id, plugin);
    this.notify();
  }

  unregister(pluginId: string): boolean {
    const removed = this.plugins.delete(pluginId);
    if (removed) {
      this.notify();
    }
    return removed;
  }

  getPlugin(pluginId: string): KmxPlugin | undefined {
    return this.plugins.get(pluginId);
  }

  hasPlugin(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }

  listPlugins(filter?: PluginFilterOptions): KmxPlugin[] {
    const all = Array.from(this.plugins.values());
    if (!filter) {
      return all;
    }

    const enabledSet = filter.enabledPluginIds
      ? new Set(filter.enabledPluginIds)
      : null;
    const capSet = filter.capabilities ? new Set(filter.capabilities) : null;

    return all.filter((plugin) => {
      if (enabledSet && !enabledSet.has(plugin.id)) {
        return false;
      }
      if (capSet && plugin.capabilities && plugin.capabilities.length > 0) {
        return plugin.capabilities.every((cap) => capSet.has(cap));
      }
      return true;
    });
  }

  getRoutes(filter?: PluginFilterOptions): WithPluginId<PluginRoute>[] {
    const routes: WithPluginId<PluginRoute>[] = [];
    for (const plugin of this.listPlugins(filter)) {
      for (const route of plugin.routes ?? []) {
        routes.push({ ...route, pluginId: plugin.id });
      }
    }
    return routes.sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
  }

  getPanels(filter?: PluginFilterOptions): WithPluginId<PluginPanel>[] {
    const panels: WithPluginId<PluginPanel>[] = [];
    for (const plugin of this.listPlugins(filter)) {
      for (const panel of plugin.panels ?? []) {
        panels.push({ ...panel, pluginId: plugin.id });
      }
    }
    return panels;
  }

  getGenerators(filter?: PluginFilterOptions): WithPluginId<PluginGenerator>[] {
    const generators: WithPluginId<PluginGenerator>[] = [];
    for (const plugin of this.listPlugins(filter)) {
      for (const generator of plugin.generators ?? []) {
        generators.push({ ...generator, pluginId: plugin.id });
      }
    }
    return generators;
  }

  getPostProcessors(
    filter?: PluginFilterOptions,
  ): WithPluginId<PluginPostProcessor>[] {
    const postProcessors: WithPluginId<PluginPostProcessor>[] = [];
    for (const plugin of this.listPlugins(filter)) {
      for (const pp of plugin.postProcessors ?? []) {
        postProcessors.push({ ...pp, pluginId: plugin.id });
      }
    }
    return postProcessors;
  }

  getSettingsSections(
    filter?: PluginFilterOptions,
  ): WithPluginId<PluginSettingsSection>[] {
    const sections: WithPluginId<PluginSettingsSection>[] = [];
    for (const plugin of this.listPlugins(filter)) {
      for (const section of plugin.settingsSections ?? []) {
        sections.push({ ...section, pluginId: plugin.id });
      }
    }
    return sections.sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
