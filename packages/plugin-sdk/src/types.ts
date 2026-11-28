import type { IgmDocument } from '@kmxcnc/igm';

export type FormFieldType = 'number' | 'string' | 'boolean' | 'select' | 'textarea';

export interface FormFieldOption {
  value: string;
  label: string;
}

export interface FormFieldSchema {
  name: string;
  label: string;
  type: FormFieldType;
  defaultValue: number | string | boolean;
  description?: string;
  placeholder?: string;
  unit?: string;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  options?: FormFieldOption[];
  order?: number;
}

/** Alias used by parametric generators for declarative parameter definitions. */
export type ParamField = FormFieldSchema;

export type PluginMountCleanup = () => void;

export interface PluginContext {
  capabilities: readonly string[];
  getState?: () => unknown;
  subscribe?: (listener: () => void) => () => void;
  loadGcode?: (filename: string, gcode: string) => void | Promise<void>;
  loadSvg?: (filename: string, svg: string) => void | Promise<void>;
  invokeAction?: (actionIndex: number) => Promise<unknown>;
  sendMdi?: (line: string) => Promise<unknown>;
  readFile?: (path: string) => Promise<string | ArrayBuffer>;
  writeFile?: (path: string, content: string | Blob) => Promise<void>;
  metadata?: Record<string, unknown>;
}

export interface PluginRoute {
  id: string;
  path: string;
  label: string;
  icon?: string;
  order?: number;
  mount?: (el: HTMLElement, ctx: PluginContext) => PluginMountCleanup | void;
}

export interface PluginPanel {
  id: string;
  title: string;
  icon?: string;
  defaultArea?: 'left' | 'right' | 'bottom' | 'center';
  mount?: (el: HTMLElement, ctx: PluginContext) => PluginMountCleanup | void;
}

export interface GeneratorOptions {
  fontBuffer?: ArrayBuffer;
}

export interface GeneratorResult {
  svg: string;
  igm?: IgmDocument;
  suggestedFilename?: string;
  warnings?: string[];
}

export interface PluginGenerator<
  TParams extends Record<string, unknown> = Record<string, unknown>,
> {
  id: string;
  name: string;
  description?: string;
  category?: string;
  params: ParamField[];
  generate: (
    params: TParams,
    options?: GeneratorOptions,
  ) => GeneratorResult | Promise<GeneratorResult>;
}

export interface PluginPostProcessor {
  id: string;
  name: string;
  description?: string;
  paramsSchema?: FormFieldSchema[];
  process: (doc: IgmDocument, params?: Record<string, unknown>) => string;
}

export interface PluginSettingsSection {
  id: string;
  title: string;
  description?: string;
  order?: number;
  fields?: FormFieldSchema[];
  mount?: (el: HTMLElement, ctx: PluginContext) => PluginMountCleanup | void;
}

export interface KmxPlugin {
  id: string;
  name: string;
  version: string;
  description?: string;
  /** Optional capability requirements (e.g. ['laser'], ['kflop']). Empty/omitted means universal. */
  capabilities?: string[];
  routes?: PluginRoute[];
  panels?: PluginPanel[];
  generators?: PluginGenerator[];
  postProcessors?: PluginPostProcessor[];
  settingsSections?: PluginSettingsSection[];
  onActivate?: (ctx: PluginContext) => void | PluginMountCleanup;
}

export interface PluginFilterOptions {
  capabilities?: readonly string[];
  enabledPluginIds?: readonly string[];
}
