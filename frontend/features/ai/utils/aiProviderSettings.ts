import type { AiConfig } from '../types/AiConfig';
import type { AiProviderId } from '../types/AiProviderId';
import type { AiProviderSettings } from '../types/AiProviderSettings';
import { AI_PROVIDERS } from '../constants/aiPresets';

const supportedProviderIds = new Set<AiProviderId>(AI_PROVIDERS.map((provider) => provider.id));

/** Returns the explicit provider list, with a legacy fallback for existing preferences. */
export function configuredProviderIds(config: AiConfig): AiProviderId[] {
  const candidates = Array.isArray(config.configuredProviders)
    ? config.configuredProviders
    : [config.provider, ...Object.keys(config.providerSettings || {}) as AiProviderId[]];
  return [...new Set(candidates.filter((id): id is AiProviderId => supportedProviderIds.has(id)))];
}

export function activeProviderSettings(config: AiConfig): AiProviderSettings {
  return {
    authMode: config.authMode,
    cliType: config.cliType,
    model: config.model,
    baseUrl: config.baseUrl,
    reasoningEffort: config.reasoningEffort,
    fastMode: config.fastMode,
  };
}

export function providerSettingsFor(config: AiConfig, providerId: AiProviderId): AiProviderSettings {
  if (providerId === config.provider) return activeProviderSettings(config);
  const saved = config.providerSettings?.[providerId];
  if (saved) return saved;
  const preset = AI_PROVIDERS.find((provider) => provider.id === providerId) || AI_PROVIDERS[0];
  return { model: preset.defaultModel, baseUrl: preset.defaultBaseUrl };
}

export function rememberActiveProviderSettings(config: AiConfig): AiConfig {
  return {
    ...config,
    providerSettings: {
      ...config.providerSettings,
      [config.provider]: activeProviderSettings(config),
    },
  };
}
