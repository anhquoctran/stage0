import React, { useState, useEffect } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { FileJson } from '../../../common/components/icons/FileJson';
import { Plus } from '../../../common/components/icons/Plus';
import { McpServerModal } from './McpServerModal';
import { McpJsonModal } from './McpJsonModal';
import { ProviderSetupModal } from './ProviderSetupModal';
import { ProviderDeleteModal } from './ProviderDeleteModal';
import { AiMcpTabHeader } from './AiMcpTabHeader';
import { AiMcpProviderTable } from './AiMcpProviderTable';
import { AiMcpProviderDetailsModal } from './AiMcpProviderDetailsModal';
import { AiMcpServersList } from './AiMcpServersList';
import { AiMcpPromptRolesView } from './AiMcpPromptRolesView';
import { useAiMcpStore } from '../store/useAiMcpStore';
import { AI_PROVIDERS, MCP_PRESET_TEMPLATES, DEFAULT_AI_CONFIG } from '../constants/aiPresets';
import { isLikelySecretMcpEnvValue, isSecretMcpEnvName } from '../utils/listSecretMcpEnv';
import { type AiConfig } from '../types/AiConfig';
import { type AiProviderId } from '../types/AiProviderId';
import { activeProviderSettings, configuredProviderIds, providerSettingsFor, rememberActiveProviderSettings } from '../utils/aiProviderSettings';
import { type McpServerConfig } from '../types/McpServerConfig';
import { type McpServerType } from '../types/McpServerType';
import type { AiMcpTabProps } from '../types/AiMcpTabProps';
import { HarnessConnectionsPanel } from '../../review/components/HarnessConnectionsPanel';
import { getProviderDisplayName } from '../utils/getProviderDisplayName';

export const AiMcpTab: React.FC<AiMcpTabProps> = ({
  draftSettings,
  draftAiConfig,
  onUpdateAiConfig,
  onNavigateToGuardrails,
  activeView,
  onBackToOverview,
}) => {
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
    const hasProviderSettingsChange = ['model', 'baseUrl', 'reasoningEffort', 'fastMode']
      .some((key) => key in partial);
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
  const [returnProviderAfterDetails, setReturnProviderAfterDetails] = useState<AiProviderId | null>(null);
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
    if (providerToRestore && providerToRestore !== aiConfig.provider) setProvider(providerToRestore);
  };

  // Add / Edit Server Form State
  const [isServerFormOpen, setIsServerFormOpen] = useState(false);
  const [editingServerId, setEditingServerId] = useState<string | null>(null);
  const [serverName, setServerName] = useState('');
  const [serverDesc, setServerDesc] = useState('');
  const [serverType, setServerType] = useState<McpServerType>('stdio');
  const [serverCommand, setServerCommand] = useState('');
  const [serverArgsStr, setServerArgsStr] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [serverEnvPairs, setServerEnvPairs] = useState<Array<{ key: string; value: string; secretConfigured?: boolean; savedKey?: string }>>([]);
  const [formError, setFormError] = useState<string | null>(null);

  // Import / Export JSON Dialog State
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
  const activeProviderPreset =
    AI_PROVIDERS.find((p) => p.id === aiConfig.provider) || AI_PROVIDERS[0];
  const configuredProviderList = configuredProviderIds(aiConfig);
  const availableProviderList = AI_PROVIDERS.filter((provider) => !configuredProviderList.includes(provider.id));
  const hasSavedApiKey = !!apiKeysConfigured[aiConfig.provider];

  useEffect(() => {
    setApiKeyDraft(draftAiConfig?.apiKey || '');
  }, [aiConfig.provider, draftAiConfig?.apiKey]);

  const enabledMcpCount = mcpServers.filter((s) => s.enabled).length;

  const handleOpenAddServer = (preset?: (typeof MCP_PRESET_TEMPLATES)[number]) => {
    setEditingServerId(null);
    setFormError(null);
    if (preset) {
      setServerName(preset.name);
      setServerDesc(preset.description);
      setServerType(preset.type);
      setServerCommand(preset.command);
      setServerArgsStr(preset.args.join(' '));
      setServerUrl(preset.url || '');
      setServerEnvPairs(
        Object.entries(preset.env).map(([k, v]) => ({ key: k, value: v }))
      );
    } else {
      setServerName('');
      setServerDesc('');
      setServerType('stdio');
      setServerCommand('');
      setServerArgsStr('');
      setServerUrl('');
      setServerEnvPairs([]);
    }
    setIsServerFormOpen(true);
  };

  const handleOpenEditServer = (server: McpServerConfig) => {
    setEditingServerId(server.id);
    setFormError(null);
    setServerName(server.name);
    setServerDesc(server.description || '');
    setServerType(server.type);
    setServerCommand(server.command);
    setServerArgsStr(server.args.join(' '));
    setServerUrl(server.url || '');
    setServerEnvPairs(
      [
        ...Object.entries(server.env).map(([key, value]) => ({ key, value })),
        ...(server.secretEnvKeys || []).filter((key) => !(key in server.env)).map((key) => ({ key, value: '', secretConfigured: true, savedKey: key })),
      ]
    );
    setIsServerFormOpen(true);
  };

  const handleSaveServer = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!serverName.trim()) {
      setFormError('Server name is required');
      return;
    }

    if (serverType === 'stdio' && !serverCommand.trim()) {
      setFormError('Executable command is required for stdio transport (e.g. npx, uvx)');
      return;
    }

    if (serverType !== 'stdio' && !serverUrl.trim()) {
      setFormError('HTTP endpoint URL is required');
      return;
    }

    const parsedArgs = serverArgsStr
      .trim()
      .split(/\s+/)
      .filter((s) => s.length > 0);

    const envMap: Record<string, string> = {};
    const secretEnvKeys = new Set<string>();
    for (const pair of serverEnvPairs) {
      if (pair.key.trim()) {
        const key = pair.key.trim();
        const value = pair.value.trim();
        const keepsSavedSecret = pair.secretConfigured && pair.savedKey === key;
        const isSecret = keepsSavedSecret || isSecretMcpEnvName(key) || isLikelySecretMcpEnvValue(value);
        if (isSecret) {
          if (value) envMap[key] = value;
          if (value || keepsSavedSecret) secretEnvKeys.add(key);
        } else {
          envMap[key] = value;
        }
      }
    }

    if (editingServerId) {
      updateMcpServer(editingServerId, {
        name: serverName.trim(),
        description: serverDesc.trim() || undefined,
        type: serverType,
        command: serverCommand.trim(),
        args: parsedArgs,
        url: serverType !== 'stdio' ? serverUrl.trim() : undefined,
        env: envMap,
        secretEnvKeys: [...secretEnvKeys],
      });
    } else {
      addMcpServer({
        name: serverName.trim(),
        description: serverDesc.trim() || undefined,
        type: serverType,
        command: serverCommand.trim(),
        args: parsedArgs,
        url: serverType !== 'stdio' ? serverUrl.trim() : undefined,
        env: envMap,
        secretEnvKeys: [...secretEnvKeys],
        enabled: true,
      });
    }

    setIsServerFormOpen(false);
  };

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
    return !draftSettings?.apiKeyRemovals.includes(providerId) && (
      !!apiKeysConfigured[providerId]
      || !!draftSettings?.apiKeyDrafts?.[providerId]
      || (providerId === aiConfig.provider && !!apiKeyDraft.trim())
    );
  };

  const isProviderConfigured = (id: string) => {
    if (id === 'ollama') return true;
    return hasProviderApiKey(id);
  };

  const loadProviderSetup = (providerId: AiProviderId) => {
    const settings = providerSettingsFor(aiConfig, providerId);
    setSetupProviderId(providerId);
    setSetupProviderName(providerId === 'custom'
      ? aiConfig.customProviderName?.trim() || 'My Custom Provider'
      : '');
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
      setProviderSetupError('This provider is already in the table. Remove it first if you want to add it again.');
      return;
    }
    try {
      const endpoint = new URL(baseUrl);
      if (!['http:', 'https:'].includes(endpoint.protocol) || !endpoint.hostname) throw new Error('invalid URL');
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
        Object.entries(aiConfig.providerSettings || {}).filter(([id]) => remaining.includes(id as AiProviderId)),
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
          Object.assign(nextConfig, providerSettingsFor({ ...aiConfig, providerSettings: remainingSettings }, nextProvider), {
            provider: nextProvider,
          });
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
      setProviderDeleteError(`Could not remove the saved API key, so the provider was kept. ${String(error)}`);
    } finally {
      setIsDeletingProvider(false);
    }
  };

  return (
    <div className="space-y-4">
      <AiMcpTabHeader
        activeView={activeView}
        activeSubTab={activeSubTab}
        onBackToOverview={onBackToOverview}
        onSelectSubTab={setActiveSubTab}
        activeProviderName={getProviderDisplayName(activeProviderPreset.id, aiConfig.customProviderName)}
        activeModel={aiConfig.model}
        enabledMcpCount={enabledMcpCount}
        totalMcpCount={mcpServers.length}
      />

      {/* VIEW: AI MODEL & PROVIDER CONFIGURATION */}
      {(activeView === 'providers' || (!activeView && (activeSubTab === 'ai' || activeSubTab === 'guardrails'))) && (
        <div className="space-y-4 animate-in fade-in duration-100">
          <AiMcpProviderTable
            configuredProviders={configuredProviderList}
            activeProviderId={aiConfig.provider}
            availableProviderList={availableProviderList}
            aiConfig={aiConfig}
            onOpenAddProvider={openAddProvider}
            onOpenProviderDetails={openProviderDetails}
            onSelectProvider={setProvider}
            onRequestDeleteProvider={(id) => {
              setProviderDeleteError(null);
              setProviderToDelete(id);
            }}
            isProviderConfigured={isProviderConfigured}
          />

          <AiMcpProviderDetailsModal
            isOpen={isProviderDetailsOpen}
            onClose={closeProviderDetails}
            aiConfig={aiConfig}
            activeProviderPreset={activeProviderPreset}
            apiKeyDraft={apiKeyDraft}
            setApiKeyDraft={setApiKeyDraft}
            hasSavedApiKey={hasSavedApiKey}
            apiKeysConfigured={apiKeysConfigured}
            isCheckingApiKey={isCheckingApiKey}
            apiKeyCheckError={apiKeyCheckError}
            onLoadApiKey={loadApiKeyForProvider}
            onUpdateAiConfig={updateAiConfig}
            dynamicModels={dynamicModels}
            isFetchingDynamicModels={isFetchingDynamicModels}
            dynamicModelError={dynamicModelError}
            onFetchDynamicModels={fetchDynamicModels}
            onTestConnection={() => void testAiConnection(aiConfig, hasSavedApiKey || !!apiKeyDraft.trim())}
            isTestingAi={isTestingAi}
            aiTestResult={aiTestResult}
            onClearTestResult={clearAiTestResult}
            onResetAiConfig={resetAiConfig}
            hasDraftSettings={Boolean(draftSettings)}
          />

          {onNavigateToGuardrails && (
            <div className="pt-1 text-right">
              <button
                type="button"
                onClick={onNavigateToGuardrails}
                className="text-xs text-subtext0 hover:text-text underline cursor-pointer"
              >
                Configure AI Security Guardrails &amp; Execution Policies →
              </button>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: MCP SERVERS (MODEL CONTEXT PROTOCOL) */}
      {activeSubTab === 'mcp' && (
        <div className="space-y-4 animate-in fade-in duration-100">
          <HarnessConnectionsPanel draftServers={draftSettings?.mcpServers} />

          {/* Header Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <span className="text-xs font-bold text-text block">
                Model Context Protocol (MCP) Ecosystem
              </span>
              <span className="text-[11px] text-subtext0 block">
                Configure external tools; discovery does not grant access to AI review runs
              </span>
            </div>

            <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsJsonModalOpen(true)}
                className="flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-1.5 border border-surface1 hover:bg-surface1 text-subtext0 hover:text-text text-xs transition-colors cursor-pointer"
                title="Import or Export JSON configuration"
              >
                <FileJson className="w-3.5 h-3.5" />
                <span>Config JSON</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenAddServer()}
                className="flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-1.5 bg-surface1 hover:bg-surface2 text-text text-xs font-semibold transition-colors cursor-pointer shadow-xs border border-surface2"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add MCP Server</span>
              </button>
            </div>
          </div>

          {/* Quick Preset Templates Bar */}
          <div className="p-2.5 bg-surface0/20 border border-surface0/80 flex flex-wrap items-center gap-2">
            <span className="shrink-0 text-[10px] font-bold text-subtext0 uppercase tracking-wider">
              Quick Add Presets:
            </span>
            {MCP_PRESET_TEMPLATES.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => handleOpenAddServer(preset)}
                className="flex shrink-0 items-center gap-1 whitespace-nowrap px-2.5 py-1 text-[11px] font-medium bg-surface0 border border-surface1 hover:bg-surface1 text-text transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3 text-subtext0" />
                <span>{preset.name}</span>
              </button>
            ))}
          </div>

          {/* Add / Edit Server Drawer / Form */}
          <McpServerModal
            isOpen={isServerFormOpen}
            onClose={() => setIsServerFormOpen(false)}
            onSave={handleSaveServer}
            editingServerId={editingServerId}
            formError={formError}
            serverName={serverName}
            setServerName={setServerName}
            serverType={serverType}
            setServerType={setServerType}
            serverDesc={serverDesc}
            setServerDesc={setServerDesc}
            serverCommand={serverCommand}
            setServerCommand={setServerCommand}
            serverArgsStr={serverArgsStr}
            setServerArgsStr={setServerArgsStr}
            serverUrl={serverUrl}
            setServerUrl={setServerUrl}
            serverEnvPairs={serverEnvPairs}
            setServerEnvPairs={setServerEnvPairs}
          />

          {/* Servers Cards List */}
          <AiMcpServersList
            mcpServers={mcpServers}
            onOpenAddServer={handleOpenAddServer}
            onOpenEditServer={handleOpenEditServer}
            onToggleServer={toggleMcpServer}
            onTestServer={handleTestServer}
            onDeleteServer={deleteMcpServer}
            testingServerId={testingServerId}
            deletingServerId={deletingServerId}
            setDeletingServerId={setDeletingServerId}
          />
        </div>
      )}

      {/* SUB-TAB 3: STAGE0 MANAGED ROLE PROMPTS */}
      {activeSubTab === 'prompts' && (
        <AiMcpPromptRolesView
          reviewerInstructions={aiConfig.reviewerInstructions}
          onUpdateReviewerInstructions={(reviewerInstructions) => updateAiConfig({ reviewerInstructions })}
        />
      )}

      {/* MODAL: ADD / EDIT LLM PROVIDER */}
      <ProviderSetupModal
        isOpen={isProviderSetupOpen}
        onClose={() => setIsProviderSetupOpen(false)}
        setupProviderId={setupProviderId}
        setupProviderName={setupProviderName}
        setSetupProviderName={setSetupProviderName}
        setupApiKey={setupApiKey}
        setSetupApiKey={setSetupApiKey}
        setupBaseUrl={setupBaseUrl}
        setSetupBaseUrl={setSetupBaseUrl}
        setupModel={setupModel}
        setSetupModel={setSetupModel}
        providerSetupError={providerSetupError}
        loadProviderSetup={loadProviderSetup}
        handleSaveProviderSetup={handleSaveProviderSetup}
        availableProviderList={availableProviderList}
        getProviderDisplayName={(id) => getProviderDisplayName(id, aiConfig.customProviderName)}
        hasProviderApiKey={hasProviderApiKey}
      />

      <ProviderDeleteModal
        providerToDelete={providerToDelete}
        onClose={() => setProviderToDelete(null)}
        onConfirm={confirmRemoveProvider}
        isDeletingProvider={isDeletingProvider}
        providerDeleteError={providerDeleteError}
        getProviderDisplayName={(id) => getProviderDisplayName(id, aiConfig.customProviderName)}
      />

      <McpJsonModal
        isOpen={isJsonModalOpen}
        onClose={() => setIsJsonModalOpen(false)}
        exportMcpConfigFile={exportMcpConfigFile}
        importMcpConfigFile={importMcpConfigFile}
      />
    </div>
  );
};
