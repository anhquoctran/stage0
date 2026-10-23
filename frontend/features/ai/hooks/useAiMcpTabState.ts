import { useEffect, useState } from 'react';
import { AI_PROVIDERS, DEFAULT_AI_CONFIG } from '../constants/aiPresets';
import { useAiMcpStore } from '../store/useAiMcpStore';
import { type AiConfig } from '../types/AiConfig';
import type { AiMcpTabProps } from '../types/AiMcpTabProps';
import {
  activeProviderSettings,
  configuredProviderIds,
  providerSettingsFor,
  rememberActiveProviderSettings,
} from '../utils/aiProviderSettings';
import { useAiProviderDetails } from './useAiProviderDetails';
import { useAiProviderRemoval } from './useAiProviderRemoval';
import { useAiProviderSetup } from './useAiProviderSetup';
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
  const details = useAiProviderDetails({ aiConfig, setProvider });

  const setup = useAiProviderSetup({
    draftSettings,
    apiKeysConfigured,
    aiConfig,
    apiKeyDraft,
    updateAiConfig,
  });

  const removal = useAiProviderRemoval({ draftSettings, aiConfig, updateAiConfig });

  const [testingServerId, setTestingServerId] = useState<string | null>(null);
  const [deletingServerId, setDeletingServerId] = useState<string | null>(null);

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

  return {
    provider: {
      apiKeysConfigured,
      isCheckingApiKey,
      apiKeyCheckError,
      isTestingAi,
      aiTestResult,
      loadApiKeyForProvider,
      testAiConnection,
      clearAiTestResult,
      dynamicModels,
      isFetchingDynamicModels,
      dynamicModelError,
      fetchDynamicModels,
      aiConfig,
      updateAiConfig,
      setProvider,
      resetAiConfig,
      apiKeyDraft,
      setApiKeyDraft,
      activeProviderPreset,
      configuredProviderList,
      availableProviderList,
      hasSavedApiKey,
    },
    mcp: {
      mcpServers,
      deleteMcpServer,
      toggleMcpServer,
      importMcpConfigFile,
      exportMcpConfigFile,
      testingServerId,
      deletingServerId,
      setDeletingServerId,
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
      enabledMcpCount,
      handleOpenAddServer,
      handleOpenEditServer,
      handleSaveServer,
      handleTestServer,
    },
    navigation: { activeSubTab, setActiveSubTab },
    details,
    setup,
    removal,
  };
}
