import { invoke, isTauri } from '@tauri-apps/api/core';
import React, { useEffect, useState } from 'react';
import { AI_PROVIDERS, DEFAULT_AI_CONFIG } from '../constants/aiPresets';
import { useAiMcpStore } from '../store/useAiMcpStore';
import { type AiConfig } from '../types/AiConfig';
import type { AiMcpTabProps } from '../types/AiMcpTabProps';
import { type AiProviderId } from '../types/AiProviderId';
import {
  activeProviderSettings,
  configuredProviderIds,
  providerSettingsFor,
  rememberActiveProviderSettings,
} from '../utils/aiProviderSettings';
import { useMcpServerForm } from './useMcpServerForm';

export function useAiMcpTabState({
  draftSettings,
  draftAiConfig,
  onUpdateAiConfig,
  activeView,
}: AiMcpTabProps) {
  const {
    aiConfig: storeAiConfig,
    apiKeysConfigured,
    isCheckingApiKey,
    apiKeyCheckError,
    mcpServers,
    isTestingAi,
    aiTestResult,
    activeSubTab,
    setActiveSubTab,
    updateAiConfig: storeUpdateAiConfig,
    resetAiConfig: storeResetAiConfig,
    setProvider: storeSetProvider,
    loadApiKeyForProvider,
    testAiConnection,
    clearAiTestResult,
    dynamicModels,
    isFetchingDynamicModels,
    dynamicModelError,
    fetchDynamicModels,
    addMcpServer,
    updateMcpServer,
    deleteMcpServer,
    toggleMcpServer,
    testMcpServer,
    importMcpConfigFile,
    exportMcpConfigFile,
  } = { ...useAiMcpStore(), ...draftSettings };

  const aiConfig = draftAiConfig || storeAiConfig;

  const updateAiConfig = (partial: Partial<AiConfig>) => {
    if (!onUpdateAiConfig) {
      storeUpdateAiConfig(partial);
      return;
    }
    const nextConfig = { ...aiConfig, ...partial };
    const hasProviderSettingsChange = ['model', 'baseUrl', 'reasoningEffort', 'fastMode'].some(
      (key) => key in partial
    );
    if (hasProviderSettingsChange) {
      const providerSettings = { ...nextConfig.providerSettings };
      if (configuredProviderIds(nextConfig).includes(nextConfig.provider)) {
        providerSettings[nextConfig.provider] = activeProviderSettings(nextConfig);
      }
      onUpdateAiConfig({ ...partial, providerSettings });
    } else {
      onUpdateAiConfig(partial);
    }
  };

  const setProvider = (providerId: AiConfig['provider']) => {
    if (providerId === aiConfig.provider) return;
    const rememberedConfig = rememberActiveProviderSettings(aiConfig);
    const selectedSettings = providerSettingsFor(rememberedConfig, providerId);
    if (onUpdateAiConfig) {
      onUpdateAiConfig({
        ...rememberedConfig,
        provider: providerId,
        ...selectedSettings,
        apiKey: '',
      });
    } else {
      storeSetProvider(providerId);
    }
  };

  const resetAiConfig = () => {
    if (draftSettings) {
      draftSettings.replace({
        aiConfig: { ...DEFAULT_AI_CONFIG },
        mcpServers: draftSettings.mcpServers,
        guardrailPolicy: draftSettings.guardrailPolicy,
        globalReviewers: draftSettings.globalReviewers,
        externalAgents: draftSettings.externalAgents,
      });
    } else if (onUpdateAiConfig) {
      onUpdateAiConfig(DEFAULT_AI_CONFIG);
    } else {
      storeResetAiConfig();
    }
  };

  const [apiKeyDraft, setApiKeyDraft] = useState(draftAiConfig?.apiKey || '');
  const [isProviderDetailsOpen, setIsProviderDetailsOpen] = useState(false);
  const [returnProviderAfterDetails, setReturnProviderAfterDetails] = useState<AiProviderId | null>(
    null
  );
  const [isProviderSetupOpen, setIsProviderSetupOpen] = useState(false);
  const [setupProviderId, setSetupProviderId] = useState<AiProviderId>('custom');
  const [setupProviderName, setSetupProviderName] = useState('');
  const [setupModel, setSetupModel] = useState('');
  const [setupBaseUrl, setSetupBaseUrl] = useState('');
  const [setupApiKey, setSetupApiKey] = useState('');
  const [providerSetupError, setProviderSetupError] = useState<string | null>(null);
  const [providerToDelete, setProviderToDelete] = useState<AiProviderId | null>(null);
  const [providerDeleteError, setProviderDeleteError] = useState<string | null>(null);
  const [isDeletingProvider, setIsDeletingProvider] = useState(false);
  const [testingServerId, setTestingServerId] = useState<string | null>(null);
  const [deletingServerId, setDeletingServerId] = useState<string | null>(null);

  const openProviderDetails = (providerId: AiProviderId) => {
    setReturnProviderAfterDetails(providerId === aiConfig.provider ? null : aiConfig.provider);
    if (providerId !== aiConfig.provider) setProvider(providerId);
    setIsProviderDetailsOpen(true);
  };

  const closeProviderDetails = () => {
    const providerToRestore = returnProviderAfterDetails;
    setIsProviderDetailsOpen(false);
    setReturnProviderAfterDetails(null);
    if (providerToRestore && providerToRestore !== aiConfig.provider)
      setProvider(providerToRestore);
  };

  const {
    isServerFormOpen,
    setIsServerFormOpen,
    editingServerId,
    serverName,
    setServerName,
    serverDesc,
    setServerDesc,
    serverType,
    setServerType,
    serverCommand,
    setServerCommand,
    serverArgsStr,
    setServerArgsStr,
    serverUrl,
    setServerUrl,
    serverEnvPairs,
    setServerEnvPairs,
    formError,
    handleOpenAddServer,
    handleOpenEditServer,
    handleSaveServer,
  } = useMcpServerForm({ addMcpServer, updateMcpServer });

  // Import / Export JSON Dialog State
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
  const activeProviderPreset =
    AI_PROVIDERS.find((p) => p.id === aiConfig.provider) || AI_PROVIDERS[0];
  const configuredProviderList = configuredProviderIds(aiConfig);
  const availableProviderList = AI_PROVIDERS.filter(
    (provider) => !configuredProviderList.includes(provider.id)
  );
  const hasSavedApiKey = !!apiKeysConfigured[aiConfig.provider];

  useEffect(() => {
    setApiKeyDraft(draftAiConfig?.apiKey || '');
  }, [aiConfig.provider, draftAiConfig?.apiKey]);

  const enabledMcpCount = mcpServers.filter((s) => s.enabled).length;

  const handleTestServer = async (id: string) => {
    setTestingServerId(id);
    try {
      await testMcpServer(id);
    } finally {
      setTestingServerId(null);
    }
  };

  useEffect(() => {
    if (activeView === 'providers') {
      setActiveSubTab('ai');
    } else if (activeView === 'mcp') {
      setActiveSubTab('mcp');
    } else if (activeView === 'prompts') {
      setActiveSubTab('prompts');
    }
  }, [activeView, setActiveSubTab]);

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

  const confirmRemoveProvider = async () => {
    if (!providerToDelete || isDeletingProvider) return;
    const providerId = providerToDelete;
    setIsDeletingProvider(true);
    setProviderDeleteError(null);
    try {
      if (!draftSettings && isTauri()) {
        await invoke('delete_ai_api_key', { provider: providerId });
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
    draftSettings,
    onUpdateAiConfig,
    activeView,
    apiKeysConfigured,
    isCheckingApiKey,
    apiKeyCheckError,
    mcpServers,
    isTestingAi,
    aiTestResult,
    activeSubTab,
    setActiveSubTab,
    loadApiKeyForProvider,
    testAiConnection,
    clearAiTestResult,
    dynamicModels,
    isFetchingDynamicModels,
    dynamicModelError,
    fetchDynamicModels,
    deleteMcpServer,
    toggleMcpServer,
    importMcpConfigFile,
    exportMcpConfigFile,
    aiConfig,
    updateAiConfig,
    setProvider,
    resetAiConfig,
    apiKeyDraft,
    setApiKeyDraft,
    isProviderDetailsOpen,
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
    providerToDelete,
    setProviderToDelete,
    providerDeleteError,
    setProviderDeleteError,
    isDeletingProvider,
    testingServerId,
    deletingServerId,
    setDeletingServerId,
    openProviderDetails,
    closeProviderDetails,
    isServerFormOpen,
    setIsServerFormOpen,
    editingServerId,
    serverName,
    setServerName,
    serverDesc,
    setServerDesc,
    serverType,
    setServerType,
    serverCommand,
    setServerCommand,
    serverArgsStr,
    setServerArgsStr,
    serverUrl,
    setServerUrl,
    serverEnvPairs,
    setServerEnvPairs,
    formError,
    isJsonModalOpen,
    setIsJsonModalOpen,
    activeProviderPreset,
    configuredProviderList,
    availableProviderList,
    hasSavedApiKey,
    enabledMcpCount,
    handleOpenAddServer,
    handleOpenEditServer,
    handleSaveServer,
    handleTestServer,
    hasProviderApiKey,
    isProviderConfigured,
    loadProviderSetup,
    openAddProvider,
    handleSaveProviderSetup,
    confirmRemoveProvider,
  };
}
