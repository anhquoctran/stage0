import { AI_PROVIDERS } from '../constants/aiPresets';
import type { AiModelPreset } from '../types/AiModelPreset';
import type { AiProviderId } from '../types/AiProviderId';

export type ProviderModelCatalogs = Record<string, AiModelPreset[]>;
export const EMPTY_PROVIDER_MODELS: AiModelPreset[] = [];

/** Opaque stable key keeps custom endpoint URLs out of app state. */
export function providerModelCatalogKey(provider: string, baseUrl: string): string {
  const value = `${provider}\u0000${baseUrl.trim().replace(/\/+$/, '')}`;
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x85ebca6b);
  }
  return `${provider}:${(first >>> 0).toString(16)}${(second >>> 0).toString(16)}`;
}

export function getProviderModelCatalog(
  catalogs: ProviderModelCatalogs,
  provider: string,
  baseUrl: string,
): AiModelPreset[] {
  return catalogs[providerModelCatalogKey(provider, baseUrl)] || EMPTY_PROVIDER_MODELS;
}

/** Keep locally verified capability metadata, but only for IDs returned by the provider API. */
export function enrichDiscoveredModels(
  provider: AiProviderId,
  discovered: AiModelPreset[],
): AiModelPreset[] {
  const knownModels = AI_PROVIDERS.find((item) => item.id === provider)?.models || [];
  return discovered.map((model) => {
    const known = knownModels.find((candidate) => candidate.id === model.id);
    return known ? { ...known, ...model, id: model.id, name: model.name || known.name } : model;
  });
}

export function preferredDiscoveredModel(
  models: AiModelPreset[],
  preferredModel?: string,
): string {
  if (preferredModel && models.some((model) => model.id === preferredModel)) return preferredModel;
  return models[0]?.id || '';
}
