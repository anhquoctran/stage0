import { useApplicationServices } from '../../../core/services/runtime/useApplicationServices';

import { useState } from 'react';
import { DEFAULT_AI_CONFIG } from '../constants/aiPresets';
import { useAiMcpStore } from '../store/useAiMcpStore';
import { type AiConfig } from '../types/AiConfig';
import { type AiProviderId } from '../types/AiProviderId';
import { configuredProviderIds, providerSettingsFor } from '../utils/aiProviderSettings';
import type { AiProviderRemovalContext } from './AiProviderRemovalContext';

export function useAiProviderRemoval({
  draftSettings,
  aiConfig,
  updateAiConfig,
}: AiProviderRemovalContext) {
  const appServices = useApplicationServices();
  const [providerToDelete, setProviderToDelete] = useState<AiProviderId | null>(null);

  const [providerDeleteError, setProviderDeleteError] = useState<string | null>(null);

  const [isDeletingProvider, setIsDeletingProvider] = useState(false);

  const confirmRemoveProvider = async () => {
    if (!providerToDelete || isDeletingProvider) return;
    const providerId = providerToDelete;
    setIsDeletingProvider(true);
    setProviderDeleteError(null);
    try {
      if (!draftSettings && appServices.platform.capabilities.keychain) {
        await appServices.aiProviders.deleteAiApiKey({ provider: providerId });
      }

      const configured = configuredProviderIds(aiConfig);
      const remaining = configured.filter((id) => id !== providerId);
      const remainingSettings = Object.fromEntries(
        Object.entries(aiConfig.providerSettings || {}).filter(([id]) =>
          remaining.includes(id as AiProviderId)
        )
      ) as AiConfig['providerSettings'];
      const nextConfig: Partial<AiConfig> = {
        ...aiConfig,
        configuredProviders: remaining,
        providerSettings: remainingSettings,
      };
      delete nextConfig.apiKey;
      if (providerId === 'custom') delete nextConfig.customProviderName;

      if (aiConfig.provider === providerId) {
        if (remaining.length) {
          const nextProvider = remaining[0];
          Object.assign(
            nextConfig,
            providerSettingsFor({ ...aiConfig, providerSettings: remainingSettings }, nextProvider),
            {
              provider: nextProvider,
            }
          );
        } else {
          const fallback = providerSettingsFor(DEFAULT_AI_CONFIG, DEFAULT_AI_CONFIG.provider);
          Object.assign(nextConfig, fallback, {
            provider: DEFAULT_AI_CONFIG.provider,
          });
        }
      }

      if (draftSettings) {
        draftSettings.removeApiKey(providerId);
        updateAiConfig(nextConfig);
      } else {
        updateAiConfig(nextConfig);
        useAiMcpStore.setState((state) => ({
          apiKeysConfigured: { ...state.apiKeysConfigured, [providerId]: false },
        }));
      }
      setProviderToDelete(null);
    } catch (error) {
      setProviderDeleteError(
        `Could not remove the saved API key, so the provider was kept. ${String(error)}`
      );
    } finally {
      setIsDeletingProvider(false);
    }
  };

  return {
    providerToDelete,
    setProviderToDelete,
    providerDeleteError,
    setProviderDeleteError,
    isDeletingProvider,
    confirmRemoveProvider,
  };
}
