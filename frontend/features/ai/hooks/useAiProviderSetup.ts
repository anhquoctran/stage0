import React, { useState } from 'react';
import { AI_PROVIDERS } from '../constants/aiPresets';
import { type AiConfig } from '../types/AiConfig';
import { type AiProviderId } from '../types/AiProviderId';
import {
  configuredProviderIds,
  providerSettingsFor,
  rememberActiveProviderSettings,
} from '../utils/aiProviderSettings';
import type { AiProviderSetupContext } from './AiProviderSetupContext';

export function useAiProviderSetup({
  draftSettings,
  apiKeysConfigured,
  aiConfig,
  apiKeyDraft,
  updateAiConfig,
}: AiProviderSetupContext) {
  const [isProviderSetupOpen, setIsProviderSetupOpen] = useState(false);

  const [setupProviderId, setSetupProviderId] = useState<AiProviderId>('custom');

  const [setupProviderName, setSetupProviderName] = useState('');

  const [setupModel, setSetupModel] = useState('');

  const [setupBaseUrl, setSetupBaseUrl] = useState('');

  const [setupApiKey, setSetupApiKey] = useState('');

  const [providerSetupError, setProviderSetupError] = useState<string | null>(null);

  const hasProviderApiKey = (id: string) => {
    const providerId = id as AiProviderId;
    return (
      !draftSettings?.apiKeyRemovals.includes(providerId) &&
      (!!apiKeysConfigured[providerId] ||
        !!draftSettings?.apiKeyDrafts?.[providerId] ||
        (providerId === aiConfig.provider && !!apiKeyDraft.trim()))
    );
  };

  const isProviderConfigured = (id: string) => {
    if (id === 'ollama') return true;
    return hasProviderApiKey(id);
  };

  const loadProviderSetup = (providerId: AiProviderId) => {
    const settings = providerSettingsFor(aiConfig, providerId);
    setSetupProviderId(providerId);
    setSetupProviderName(
      providerId === 'custom' ? aiConfig.customProviderName?.trim() || 'My Custom Provider' : ''
    );
    setSetupModel(settings.model);
    setSetupBaseUrl(settings.baseUrl);
    setSetupApiKey('');
    setProviderSetupError(null);
    setIsProviderSetupOpen(true);
  };

  const openAddProvider = () => {
    const configured = configuredProviderIds(aiConfig);
    const firstAvailable = AI_PROVIDERS.find((provider) => !configured.includes(provider.id));
    if (firstAvailable) loadProviderSetup(firstAvailable.id);
  };

  const handleSaveProviderSetup = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProviderSetupError(null);
    const model = setupModel.trim();
    const baseUrl = setupBaseUrl.trim().replace(/\/+$/, '');

    if (setupProviderId === 'custom' && !setupProviderName.trim()) {
      setProviderSetupError('Enter a name for this custom provider.');
      return;
    }
    if (!model) {
      setProviderSetupError('Enter a model ID.');
      return;
    }
    if (configuredProviderIds(aiConfig).includes(setupProviderId)) {
      setProviderSetupError(
        'This provider is already in the table. Remove it first if you want to add it again.'
      );
      return;
    }
    try {
      const endpoint = new URL(baseUrl);
      if (!['http:', 'https:'].includes(endpoint.protocol) || !endpoint.hostname)
        throw new Error('invalid URL');
    } catch {
      setProviderSetupError('Enter a valid HTTP or HTTPS base URL.');
      return;
    }

    const needsApiKey = setupProviderId !== 'ollama';
    if (needsApiKey && !setupApiKey.trim() && !hasProviderApiKey(setupProviderId)) {
      setProviderSetupError('Enter an API key or select a different connection method.');
      return;
    }

    const configured = configuredProviderIds(aiConfig);
    const rememberedConfig = configured.includes(aiConfig.provider)
      ? rememberActiveProviderSettings(aiConfig)
      : aiConfig;
    const currentSettings = providerSettingsFor(rememberedConfig, setupProviderId);
    const rememberedPreferences: Partial<AiConfig> = { ...rememberedConfig };
    delete rememberedPreferences.apiKey;
    const nextProviderSettings = {
      ...currentSettings,
      model,
      baseUrl,
    };
    const nextConfig: Partial<AiConfig> = {
      ...rememberedPreferences,
      providerSettings: {
        ...rememberedConfig.providerSettings,
        [setupProviderId]: nextProviderSettings,
      },
      configuredProviders: [...configured, setupProviderId],
      provider: setupProviderId,
      ...nextProviderSettings,
      ...(setupProviderId !== aiConfig.provider ? { apiKey: '' } : {}),
      ...(setupProviderId === 'custom' ? { customProviderName: setupProviderName.trim() } : {}),
    };

    updateAiConfig(nextConfig);
    if (setupApiKey.trim()) updateAiConfig({ apiKey: setupApiKey.trim() });
    setIsProviderSetupOpen(false);
  };

  return {
    isProviderSetupOpen,
    setIsProviderSetupOpen,
    setupProviderId,
    setupProviderName,
    setSetupProviderName,
    setupModel,
    setSetupModel,
    setupBaseUrl,
    setSetupBaseUrl,
    setupApiKey,
    setSetupApiKey,
    providerSetupError,
    hasProviderApiKey,
    isProviderConfigured,
    loadProviderSetup,
    openAddProvider,
    handleSaveProviderSetup,
  };
}
