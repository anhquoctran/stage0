import React, { useState, useEffect } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { Cable } from '../../../common/components/icons/Cable';
import { Plus } from '../../../common/components/icons/Plus';
import { Trash2 } from '../../../common/components/icons/Trash2';
import { Check } from '../../../common/components/icons/Check';
import { ChevronLeft } from '../../../common/components/icons/ChevronLeft';
import { Copy } from '../../../common/components/icons/Copy';
import { RefreshCw } from '../../../common/components/icons/RefreshCw';
import { AlertCircle } from '../../../common/components/icons/AlertCircle';
import { Eye } from '../../../common/components/icons/Eye';
import { EyeOff } from '../../../common/components/icons/EyeOff';
import { ExternalLink } from '../../../common/components/icons/ExternalLink';
import { FileJson } from '../../../common/components/icons/FileJson';
import { Terminal } from '../../../common/components/icons/Terminal';
import { Globe } from '../../../common/components/icons/Globe';
import { RotateCcw } from '../../../common/components/icons/RotateCcw';
import { CheckCircle2 } from '../../../common/components/icons/CheckCircle2';
import { X } from '../../../common/components/icons/X';
import { ShieldCheck } from '../../../common/components/icons/ShieldCheck';
import { Edit3 } from '../../../common/components/icons/Edit3';
import { Bot } from '../../../common/components/icons/Bot';
import { Sparkles } from '../../../common/components/icons/Sparkles';
import { Zap } from '../../../common/components/icons/Zap';
import { HardDrive } from '../../../common/components/icons/HardDrive';
import { Cog } from '../../../common/components/icons/Cog';
import { CustomSelect } from '../../../common/components/CustomSelect';
import { AiModelExecutionOptions } from './AiModelExecutionOptions';
import type { CustomSelectOption } from '../../../common/types/CustomSelectOption';
import { useAiMcpStore } from '../store/useAiMcpStore';
import { AI_PROVIDERS, MCP_PRESET_TEMPLATES, DEFAULT_AI_CONFIG } from '../constants/aiPresets';
import { isLikelySecretMcpEnvValue, isSecretMcpEnvName } from '../utils/listSecretMcpEnv';
import { resolveAiModelPreset } from '../utils/resolveAiModelPreset';
import { type AiConfig } from '../types/AiConfig';
import { type AiProviderId } from '../types/AiProviderId';
import { activeProviderSettings, configuredProviderIds, providerSettingsFor, rememberActiveProviderSettings } from '../utils/aiProviderSettings';
import { type McpServerConfig } from '../types/McpServerConfig';
import { type McpServerType } from '../types/McpServerType';
import type { AiMcpTabProps } from '../types/AiMcpTabProps';
import { HarnessConnectionsPanel } from '../../review/components/HarnessConnectionsPanel';
import { BOT_CATEGORIES } from '../constants/botPresets';
import type { BotCategory } from '../../virtual-mr/types/BotCategory';
import { getBotRolePrompt } from '../utils/botRolePrompts';

const MAX_TOKEN_OPTIONS: CustomSelectOption<string>[] = [
  { value: '1024', label: '1,024 Tokens (Compact)' },
  { value: '2048', label: '2,048 Tokens (Standard)' },
  { value: '4096', label: '4,096 Tokens (Recommended for Diffs)' },
  { value: '8192', label: '8,192 Tokens (Large MR Review)' },
  { value: '16384', label: '16,384 Tokens (Deep Reasoning / Extended)' },
];

const MCP_SERVER_TYPE_OPTIONS: CustomSelectOption<McpServerType>[] = [
  { value: 'stdio', label: 'stdio (Command / Subprocess)' },
  { value: 'http', label: 'Streamable HTTP (MCP 2025-11-25 discovery)' },
  { value: 'sse', label: 'Legacy HTTP+SSE (configuration only)' },
];

const PROMPT_ROLE_OPTIONS: CustomSelectOption<BotCategory>[] = BOT_CATEGORIES.map((category) => ({
  value: category.id,
  label: category.label,
}));

const getProviderIcon = (providerId: string) => {
  switch (providerId) {
    case 'openai':
      return Sparkles;
    case 'anthropic':
      return Bot;
    case 'gemini':
      return Globe;
    case 'xai_grok':
      return Zap;
    case 'ollama':
      return HardDrive;
    case 'custom':
    default:
      return Cog;
  }
};

const openUrlInBrowser = async (url: string) => {
  if (isTauri()) {
    try {
      await invoke('open_external_url', { url });
      return;
    } catch {
      // fallback
    }
  }
  window.open(url, '_blank');
};

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
  const [promptPreviewRole, setPromptPreviewRole] = useState<BotCategory>('custom');
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
      draftSettings.replace({ aiConfig: { ...DEFAULT_AI_CONFIG }, mcpServers: draftSettings.mcpServers, guardrailPolicy: draftSettings.guardrailPolicy, globalReviewers: draftSettings.globalReviewers, externalAgents: draftSettings.externalAgents });
    } else if (onUpdateAiConfig) {
      onUpdateAiConfig(DEFAULT_AI_CONFIG);
    } else {
      storeResetAiConfig();
    }
  };

  const [showApiKey, setShowApiKey] = useState(false);
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
  const [jsonTab, setJsonTab] = useState<'export' | 'import'>('export');
  const [jsonInput, setJsonInput] = useState('');
  const [jsonFeedback, setJsonFeedback] = useState<{ success?: boolean; text: string } | null>(null);
  const [copiedJson, setCopiedJson] = useState(false);

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

    // Convert args string to array (split by space but preserve quoted tokens if simple)
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

  const handleCopyJson = () => {
    const jsonStr = exportMcpConfigFile();
    navigator.clipboard.writeText(jsonStr);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const handleImportJson = () => {
    setJsonFeedback(null);
    if (!jsonInput.trim()) {
      setJsonFeedback({ success: false, text: 'Please paste valid JSON configuration first.' });
      return;
    }

    const res = importMcpConfigFile(jsonInput.trim());
    if (res.success) {
      setJsonFeedback({
        success: true,
        text: `Successfully imported ${res.count} MCP server(s)!`,
      });
      setTimeout(() => {
        setIsJsonModalOpen(false);
        setJsonFeedback(null);
      }, 1500);
    } else {
      setJsonFeedback({
        success: false,
        text: res.error || 'Failed to import JSON.',
      });
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

  const isProviderConfigured = (id: string) => {
    const hasApiKey = hasProviderApiKey(id);
    if (id === 'ollama') {
      return true;
    }
    return hasApiKey;
  };

  const hasProviderApiKey = (id: string) => {
    const providerId = id as AiProviderId;
    return !draftSettings?.apiKeyRemovals.includes(providerId) && (
      !!apiKeysConfigured[providerId]
      || !!draftSettings?.apiKeyDrafts?.[providerId]
      || (providerId === aiConfig.provider && !!apiKeyDraft.trim())
    );
  };

  const getProviderDisplayName = (id: string) => {
    switch (id) {
      case 'openai': return 'OpenAI / ChatGPT';
      case 'anthropic': return 'Anthropic Claude';
      case 'gemini': return 'Google Gemini';
      case 'xai_grok': return 'SuperGrok';
      case 'ollama': return 'Ollama (Local)';
      case 'custom': return aiConfig.customProviderName?.trim() || 'Custom Endpoint';
      default: return id;
    }
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

  const ActiveProviderIcon = getProviderIcon(activeProviderPreset.id);

  return (
    <div className="space-y-4">
      {onBackToOverview && (
        <div className="flex items-center gap-2 pb-1 border-b border-surface0/40">
          <button
            type="button"
            onClick={onBackToOverview}
            className="inline-flex items-center gap-1 text-xs text-subtext0 hover:text-text transition-colors cursor-pointer group"
          >
            <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span>AI Overview</span>
          </button>
          <span className="text-xs text-surface2 font-mono">/</span>
          <span className="text-xs font-semibold text-text">
            {activeView === 'mcp' ? 'MCP Servers' : 'LLM Providers'}
          </span>
        </div>
      )}

      {/* Standalone Header & Sub-Navigation (only when not embedded inside a specific view) */}
      {!activeView && (
        <div className="flex flex-col gap-3 pb-3 border-b border-surface0">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-text">
                AI & Model Context Protocol (MCP)
              </h3>
              <p className="text-[11px] text-subtext0 mt-0.5">
                Configure LLM intelligence, automated diff reviewer, and Model Context Protocol servers
              </p>
            </div>
            <span className="text-[10px] text-subtext0 font-mono px-2 py-0.5 bg-surface0 border border-surface1">
              Active: {getProviderDisplayName(activeProviderPreset.id)} • {aiConfig.model}
            </span>
          </div>

          <div className="flex items-center gap-1.5 pt-1 border-t border-surface0/60">
            <button
              type="button"
              onClick={() => setActiveSubTab('ai')}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer border ${
                activeSubTab === 'ai' || activeSubTab === 'guardrails'
                  ? 'bg-surface1 border-surface2 text-text shadow-xs ring-1 ring-surface2'
                  : 'border-transparent text-subtext0 hover:bg-surface0 hover:text-text'
              }`}
            >
              <span>AI Model & Security Policies</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('mcp')}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer border ${
                activeSubTab === 'mcp'
                  ? 'bg-surface1 border-surface2 text-text shadow-xs ring-1 ring-surface2'
                  : 'border-transparent text-subtext0 hover:bg-surface0 hover:text-text'
              }`}
            >
              <span>MCP Servers</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-base border border-surface2 font-mono">
                {enabledMcpCount}/{mcpServers.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('prompts')}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer border ${
                activeSubTab === 'prompts'
                  ? 'bg-surface1 border-surface2 text-text shadow-xs ring-1 ring-surface2'
                  : 'border-transparent text-subtext0 hover:bg-surface0 hover:text-text'
              }`}
            >
              <span>Stage0 System Prompts</span>
            </button>
          </div>
        </div>
      )}

      {/* VIEW: AI MODEL & PROVIDER CONFIGURATION */}
      {(activeView === 'providers' || (!activeView && (activeSubTab === 'ai' || activeSubTab === 'guardrails'))) && (
        <div className="space-y-4 animate-in fade-in duration-100">
          {/* Provider management table */}
          <div className="overflow-hidden border border-surface1  bg-base/60">
            <div className="flex items-center justify-between gap-3 px-3.5 py-3 border-b border-surface1">
              <div>
                <h4 className="text-xs font-bold text-text">Providers</h4>
                <p className="text-[10px] text-subtext0 mt-0.5">Only providers you add and configure appear here. The active provider is marked in the table.</p>
              </div>
              <button
                type="button"
                onClick={openAddProvider}
                disabled={availableProviderList.length === 0}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-brand text-base text-[11px] font-semibold hover:brightness-110 transition cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add provider</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left">
                <thead>
                  <tr className="border-b border-surface1 bg-surface0/40 text-[9px] uppercase tracking-wider text-subtext0">
                    <th className="px-3.5 py-2 font-semibold">Provider</th>
                    <th className="px-3.5 py-2 font-semibold">Endpoint & model</th>
                    <th className="px-3.5 py-2 font-semibold">Connection</th>
                    <th className="px-3.5 py-2 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {AI_PROVIDERS.filter((provider) => configuredProviderList.includes(provider.id)).map((provider) => {
                    const isActive = aiConfig.provider === provider.id;
                    const settings = providerSettingsFor(aiConfig, provider.id);
                    const configured = isProviderConfigured(provider.id);
                    const ProviderIcon = getProviderIcon(provider.id);
                    return (
                      <tr key={provider.id} className={`border-b border-surface1/70 last:border-0 ${isActive ? 'bg-surface0/70' : 'hover:bg-surface0/35'}`}>
                        <td className="px-3.5 py-2.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className={`w-7 h-7  border border-surface2 bg-surface0 flex items-center justify-center shrink-0 ${isActive ? 'text-brand' : 'text-subtext0'}`}>
                              <ProviderIcon className="w-3.5 h-3.5" />
                            </span>
                            <span className="min-w-0">
                              <span className="block text-[11px] font-semibold text-text truncate">{getProviderDisplayName(provider.id)}</span>
                              <span className="block text-[9px] text-subtext0 truncate">{provider.description}</span>
                            </span>
                          </div>
                        </td>
                        <td className="px-3.5 py-2.5 max-w-0">
                          <code className="block text-[10px] text-subtext0 truncate" title={settings.baseUrl}>{settings.baseUrl}</code>
                          <span className="block text-[10px] text-text/80 mt-0.5 truncate" title={settings.model}>{settings.model}</span>
                        </td>
                        <td className="px-3.5 py-2.5">
                          <span className={`inline-flex items-center gap-1.5 text-[10px] ${isActive ? 'text-brand' : configured ? 'text-green' : 'text-subtext0'}`}>
                            <span className={`w-1.5 h-1.5 ${isActive ? 'bg-brand' : configured ? 'bg-green' : 'bg-surface2'}`} />
                            {isActive ? 'Active' : configured ? 'Ready' : 'Needs sign-in'}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openProviderDetails(provider.id)}
                              className="px-2.5 py-1 border border-surface2 text-[10px] font-semibold text-text hover:bg-surface1 transition cursor-pointer"
                            >
                              Configure
                            </button>
                            {!isActive && (
                              <button
                                type="button"
                                onClick={() => setProvider(provider.id)}
                                className="px-2.5 py-1 border border-surface2 text-[10px] font-semibold text-text hover:bg-surface1 transition cursor-pointer"
                              >
                                Use
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setProviderDeleteError(null);
                                setProviderToDelete(provider.id);
                              }}
                              aria-label={`Remove ${getProviderDisplayName(provider.id)}`}
                              title="Remove provider and saved configuration"
                              className="inline-flex items-center justify-center w-7 h-7 border border-surface2 text-subtext0 hover:border-red/50 hover:text-red transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {configuredProviderList.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-9 text-center text-[11px] text-subtext0">
                        No providers added yet. Add a supported provider and complete its connection details to get started.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* MODAL: PROVIDER DETAILS */}
          {isProviderDetailsOpen && (
            <div
              className="fixed inset-x-0 bottom-0 top-8.5 z-50 bg-[var(--backdrop-modal)] backdrop-blur-xs"
              onClick={closeProviderDetails}
              aria-hidden="true"
            />
          )}
          <div
            className={`p-4 border border-surface1 space-y-4 ${isProviderDetailsOpen
              ? 'fixed inset-x-4 top-12 bottom-4 z-60 mx-auto max-w-4xl overflow-y-auto bg-mantle shadow-2xl'
              : 'hidden'
            }`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="provider-details-title"
          >
            {/* Header: Active Provider Info & Docs */}
            <div className="flex items-center justify-between pb-3 border-b border-surface1/60">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8  bg-surface1 border border-surface2 flex items-center justify-center text-brand shrink-0">
                  <ActiveProviderIcon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 id="provider-details-title" className="text-xs font-bold text-text">{getProviderDisplayName(activeProviderPreset.id)}</h4>
                    <span className="text-[10px] px-2 py-0.5  bg-surface1 text-subtext0 border border-surface2 font-mono shrink-0">
                      {aiConfig.provider === 'ollama'
                        ? 'Offline Local'
                        : 'API Key'}
                    </span>
                  </div>
                  <p className="text-[11px] text-subtext0 mt-0.5">{activeProviderPreset.description}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {activeProviderPreset.docUrl && (
                  <a
                    href={activeProviderPreset.docUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => {
                      e.preventDefault();
                      if (activeProviderPreset.docUrl) {
                        void openUrlInBrowser(activeProviderPreset.docUrl);
                      }
                    }}
                    className="flex items-center gap-1 text-[11px] text-subtext0 hover:text-text underline cursor-pointer"
                  >
                    <span>Documentation</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={closeProviderDetails}
                  className="p-1 text-subtext0 hover:text-text transition-colors cursor-pointer"
                  aria-label="Close provider details"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {aiConfig.provider === 'custom' && (
              <div>
                <label htmlFor="custom-provider-display-name" className="block text-xs font-semibold text-text mb-1">Provider display name</label>
                <input
                  id="custom-provider-display-name"
                  value={aiConfig.customProviderName || ''}
                  onChange={(event) => updateAiConfig({ customProviderName: event.target.value })}
                  placeholder="e.g. OpenRouter, DeepSeek, LM Studio"
                  className="w-full px-3 py-1.5 bg-base border border-surface1 text-xs text-text placeholder:text-subtext0 focus:outline-none focus:border-surface2"
                />
              </div>
            )}

            {/* Built-in providers use API keys; Ollama stays local and credential-free. */}
            <div className="space-y-2.5">
              {activeProviderPreset.requiresApiKey ? (
                <div className="p-3 bg-base/60 border border-surface1">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-text">
                      API Secret Key <span className="text-red">*</span>
                    </label>
                    <span className="text-[10px] text-green/90 font-mono">
                      {apiKeyDraft.trim() && draftSettings ? 'Pending key change · Apply or OK to save' : hasSavedApiKey ? '✓ Stored securely in OS Keyring' : apiKeysConfigured[aiConfig.provider] === false ? 'No saved key found' : 'Saved key not checked'}
                    </span>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={apiKeyDraft}
                      onChange={(event) => {
                        const value = event.target.value;
                        setApiKeyDraft(value);
                        if (onUpdateAiConfig) onUpdateAiConfig({ apiKey: value });
                      }}
                      onBlur={() => {
                        if (!onUpdateAiConfig && apiKeyDraft.trim()) {
                          storeUpdateAiConfig({ apiKey: apiKeyDraft });
                          setApiKeyDraft('');
                        }
                      }}
                      placeholder={hasSavedApiKey ? 'Key saved securely. Enter a new key to replace it.' : 'Paste your provider API key'}
                      className="w-full px-3 pr-10 py-1.5 bg-base border border-surface1 text-xs text-text font-mono placeholder:text-subtext0 focus:outline-none focus:border-surface2"
                    />
                    <button type="button" onClick={() => setShowApiKey(!showApiKey)} className="absolute right-2.5 p-1 text-subtext0 hover:text-text cursor-pointer" title={showApiKey ? 'Hide secret key' : 'Show secret key'}>
                      {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <button type="button" disabled={isCheckingApiKey} onClick={() => void loadApiKeyForProvider(aiConfig.provider)} className="mt-2 border border-surface1 px-2.5 py-1 text-[11px] disabled:opacity-40" title="Checks only whether a key is saved in the OS keyring.">{isCheckingApiKey ? 'Checking…' : 'Check saved API key'}</button>
                  {apiKeyCheckError && <p role="alert" className="mt-2 text-red">{apiKeyCheckError}</p>}
                </div>
              ) : (
                <div className="p-3 bg-base/60 border border-surface1 flex items-center gap-2.5 text-xs text-subtext0">
                  <ShieldCheck className="w-4 h-4 text-green shrink-0" />
                  <span>Ollama runs locally on this machine (http://localhost:11434) and does not need an API key.</span>
                </div>
              )}
            </div>
            {/* SECTION 2: MODEL SELECTION & INFERENCE PARAMETERS */}
            {(() => {
              const currentDynamic = dynamicModels[aiConfig.provider];
              const modelsList = currentDynamic && currentDynamic.length > 0 ? currentDynamic : activeProviderPreset.models;
              const selectedModelInfo = resolveAiModelPreset(aiConfig.provider, aiConfig.model, aiConfig.baseUrl, modelsList);
              const selectModel = (model: string) => {
                const nextModel = resolveAiModelPreset(aiConfig.provider, model, aiConfig.baseUrl, modelsList);
                updateAiConfig({
                  model,
                  reasoningEffort: nextModel?.reasoningEfforts?.includes(aiConfig.reasoningEffort as NonNullable<AiConfig['reasoningEffort']>)
                    ? aiConfig.reasoningEffort
                    : undefined,
                  fastMode: nextModel?.supportsFastMode ? aiConfig.fastMode : false,
                });
              };
              const modelOptions: CustomSelectOption<string>[] = [
                ...(aiConfig.model && !modelsList.some((model) => model.id === aiConfig.model)
                  ? [{ value: aiConfig.model, label: `${aiConfig.model} (Custom / Active)` }]
                  : []),
                ...modelsList.map((model) => ({
                  value: model.id,
                  label: `${model.name || model.id}${model.recommendedFor ? ` — ${model.recommendedFor}` : ''}`,
                })),
              ];

              return (
                <div className="space-y-3 pt-3 border-t border-surface1/60">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-text">Model</label>
                      <button type="button" disabled={isFetchingDynamicModels || !!apiKeyDraft.trim()} onClick={() => void fetchDynamicModels(aiConfig)} className="text-[11px] text-subtext0 hover:text-text disabled:opacity-40" title="Refresh models using saved API credentials. Apply key changes first.">{isFetchingDynamicModels ? 'Refreshing…' : 'Refresh models'}</button>
                    </div>
                    <CustomSelect
                      value={aiConfig.model}
                      options={modelOptions}
                      onChange={selectModel}
                      className="w-full"
                      buttonClassName="w-full py-2 font-mono"
                      dropdownWidth="w-full"
                      align="left"
                      aria-label="Model"
                    />
                    {dynamicModelError && <p role="alert" className="mt-1 text-xs text-red">{dynamicModelError}</p>}
                    {selectedModelInfo?.recommendedFor && (
                      <div className="text-[10px] text-subtext0 italic px-1 mt-1">
                        Recommended: {selectedModelInfo.recommendedFor}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-1">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-medium text-text">
                          Temperature: <span className="font-mono text-text">{aiConfig.temperature}</span>
                        </label>
                        <span className="text-[10px] text-subtext0 font-mono">
                          {aiConfig.temperature <= 0.2 ? 'Deterministic' : 'Balanced'}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={aiConfig.temperature}
                        onChange={(e) => updateAiConfig({ temperature: parseFloat(e.target.value) })}
                        className="w-full h-1.5 bg-surface1 appearance-none cursor-pointer accent-text "
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-medium text-text">Max Output Tokens</label>
                        <span className="text-[10px] text-subtext0 font-mono">{aiConfig.maxTokens} tokens</span>
                      </div>
                      <CustomSelect
                        value={String(aiConfig.maxTokens)}
                        options={MAX_TOKEN_OPTIONS}
                        onChange={(tokens) => updateAiConfig({ maxTokens: parseInt(tokens, 10) })}
                        className="w-full"
                        buttonClassName="w-full font-mono"
                        dropdownWidth="w-full"
                        align="left"
                        aria-label="Max Output Tokens"
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-surface1/60">
                    <AiModelExecutionOptions
                      model={selectedModelInfo}
                      reasoningEffort={aiConfig.reasoningEffort}
                      fastMode={aiConfig.fastMode === true}
                      onReasoningEffortChange={(reasoningEffort) => updateAiConfig({ reasoningEffort })}
                      onFastModeChange={(fastMode) => updateAiConfig({ fastMode })}
                      emptyMessage="Stage0 has no declared reasoning or Fast mode capabilities for this provider and model."
                    />
                  </div>
                </div>
              );
            })()}

            {/* SECTION 3: NETWORK ENDPOINT & BEHAVIOR OPTIONS */}
            <div className="space-y-3 pt-3 border-t border-surface1/60">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-text">API Base URL / Endpoint</label>
                  {aiConfig.baseUrl !== activeProviderPreset.defaultBaseUrl && (
                    <button
                      type="button"
                      onClick={() => updateAiConfig({ baseUrl: activeProviderPreset.defaultBaseUrl })}
                      className="text-[10px] text-subtext0 hover:text-text underline cursor-pointer"
                    >
                      Reset default ({activeProviderPreset.defaultBaseUrl})
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={aiConfig.baseUrl}
                  onChange={(e) => {
                    const baseUrl = e.target.value;
                    const nextModel = resolveAiModelPreset(aiConfig.provider, aiConfig.model, baseUrl, dynamicModels[aiConfig.provider]);
                    updateAiConfig({ baseUrl, reasoningEffort: undefined, fastMode: nextModel?.supportsFastMode ? aiConfig.fastMode : false });
                  }}
                  placeholder="https://api.openai.com/v1"
                  className="w-full px-3 py-1.5 bg-base border border-surface1 text-xs text-text font-mono placeholder:text-subtext0 focus:outline-none focus:border-surface2 "
                />
              </div>

              <div className="flex items-center justify-between gap-6 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-text select-none">
                  <input
                    type="checkbox"
                    checked={aiConfig.streamResponse}
                    onChange={(e) => updateAiConfig({ streamResponse: e.target.checked })}
                    className="w-4 h-4 accent-text cursor-pointer "
                  />
                  <span>Stream responses in real-time</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-text select-none">
                  <input
                    type="checkbox"
                    checked={aiConfig.enableCodeReviewAssist}
                    onChange={(e) => updateAiConfig({ enableCodeReviewAssist: e.target.checked })}
                    className="w-4 h-4 accent-text cursor-pointer "
                  />
                  <span>Auto-summarize Git commits &amp; diffs</span>
                </label>
              </div>
            </div>

            {/* SECTION 4: HEALTH CHECK & ACTION FOOTER */}
            <div className="pt-3 border-t border-surface1/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void testAiConnection(aiConfig, hasSavedApiKey || !!apiKeyDraft.trim())}
                  disabled={isTestingAi}
                  title="Native API tests use saved OS credentials, send no repository source and may incur provider charges. Apply API key changes first."
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-surface1 hover:bg-surface2 text-text text-xs font-semibold  transition-colors cursor-pointer border border-surface2 shadow-xs"
                >
                  {isTestingAi ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Testing...</span>
                    </>
                  ) : (
                    <span>Test Connection</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={resetAiConfig}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs text-subtext0 hover:text-text hover:bg-surface1/40  transition-colors cursor-pointer"
                  title="Reset provider settings to defaults"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              </div>

              {/* Inline Test Result */}
              {aiTestResult && (
                <div
                  className={`flex items-center gap-2 px-2.5 py-1  text-xs animate-in fade-in ${
                    aiTestResult.success
                      ? 'bg-green/10 text-green border border-green/20'
                      : 'bg-red/10 text-red border border-red/20'
                  }`}
                >
                  {aiTestResult.success ? (
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span className="truncate max-w-[280px]">{aiTestResult.message}</span>
                  <button
                    type="button"
                    onClick={clearAiTestResult}
                    className="text-subtext0 hover:text-text cursor-pointer ml-1"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>

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
                onClick={() => {
                  setJsonTab('export');
                  setJsonFeedback(null);
                  setIsJsonModalOpen(true);
                }}
                className="flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-1.5  border border-surface1 hover:bg-surface1 text-subtext0 hover:text-text text-xs transition-colors cursor-pointer"
                title="Import or Export JSON configuration"
              >
                <FileJson className="w-3.5 h-3.5" />
                <span>Config JSON</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenAddServer()}
                className="flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-1.5 bg-surface1 hover:bg-surface2 text-text text-xs font-semibold  transition-colors cursor-pointer shadow-xs border border-surface2"
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
                className="flex shrink-0 items-center gap-1 whitespace-nowrap px-2.5 py-1  text-[11px] font-medium bg-surface0 border border-surface1 hover:bg-surface1 text-text transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3 text-subtext0" />
                <span>{preset.name}</span>
              </button>
            ))}
          </div>

          {/* Add / Edit Server Drawer / Form */}
          {isServerFormOpen && (
            <form
              onSubmit={handleSaveServer}
              className="p-4 bg-surface0/60 border border-surface1 space-y-4 animate-in fade-in zoom-in-98 duration-150"
            >
              <div className="flex items-center justify-between pb-2 border-b border-surface1/60">
                <span className="text-xs font-bold text-text flex items-center gap-1.5">
                  <Cable className="w-3.5 h-3.5 text-subtext0" />
                  {editingServerId ? 'Edit MCP Server' : 'Add New MCP Server'}
                </span>
                <button
                  type="button"
                  onClick={() => setIsServerFormOpen(false)}
                  className="p-1 text-subtext0 hover:text-text  cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {formError && (
                <div className="p-2.5 bg-red/10 border border-red/30 text-xs text-red flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                {/* Server Name */}
                <div className="col-span-2">
                  <label className="block text-[11px] font-medium text-subtext0 mb-1">
                    Server Name <span className="text-red">*</span>
                  </label>
                  <input
                    type="text"
                    value={serverName}
                    onChange={(e) => setServerName(e.target.value)}
                    placeholder="e.g. Git Context, Workspace Filesystem"
                    required
                    className="w-full px-3 py-1.5 bg-base border border-surface1 text-xs text-text placeholder:text-subtext0 focus:outline-none focus:border-surface2"
                  />
                </div>

                {/* Transport Type */}
                <div>
                  <label className="block text-[11px] font-medium text-subtext0 mb-1">
                    Transport Protocol
                  </label>
                  <CustomSelect
                    value={serverType}
                    options={MCP_SERVER_TYPE_OPTIONS}
                    onChange={setServerType}
                    className="w-full"
                    buttonClassName="w-full"
                    dropdownWidth="w-full"
                    align="left"
                    aria-label="Transport Protocol"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-[11px] font-medium text-subtext0 mb-1">
                  Description <span className="text-subtext0/60 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={serverDesc}
                  onChange={(e) => setServerDesc(e.target.value)}
                  placeholder="e.g. Provides read access to git branches and diff graphs"
                  className="w-full px-3 py-1.5 bg-base border border-surface1 text-xs text-text placeholder:text-subtext0 focus:outline-none focus:border-surface2"
                />
              </div>

              {/* Stdio Commands & Args */}
              {serverType === 'stdio' ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-subtext0 mb-1">
                        Executable Command <span className="text-red">*</span>
                      </label>
                      <div className="relative flex items-center">
                        <Terminal className="w-3.5 h-3.5 text-subtext0 absolute left-2.5" />
                        <input
                          type="text"
                          value={serverCommand}
                          onChange={(e) => setServerCommand(e.target.value)}
                          placeholder="npx, uvx, docker, python"
                          required
                          className="w-full pl-8 pr-3 py-1.5 bg-base border border-surface1 text-xs text-text font-mono placeholder:text-subtext0 focus:outline-none focus:border-surface2"
                        />
                      </div>
                    </div>

                    <div className="col-span-2">
                      <label className="block text-[11px] font-medium text-subtext0 mb-1">
                        Arguments (space-separated)
                      </label>
                      <input
                        type="text"
                        value={serverArgsStr}
                        onChange={(e) => setServerArgsStr(e.target.value)}
                        placeholder="-y @modelcontextprotocol/server-filesystem ."
                        className="w-full px-3 py-1.5 bg-base border border-surface1 text-xs text-text font-mono placeholder:text-subtext0 focus:outline-none focus:border-surface2"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                /* HTTP endpoint */
                <div>
                  <label className="block text-[11px] font-medium text-subtext0 mb-1">
                    {serverType === 'http' ? 'Streamable HTTP Endpoint URL' : 'Legacy SSE Endpoint URL'} <span className="text-red">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <Globe className="w-3.5 h-3.5 text-subtext0 absolute left-2.5" />
                    <input
                      type="url"
                      value={serverUrl}
                      onChange={(e) => setServerUrl(e.target.value)}
                      placeholder={serverType === 'http' ? 'http://localhost:8000/mcp' : 'http://localhost:8000/sse'}
                      required
                      className="w-full pl-8 pr-3 py-1.5 bg-base border border-surface1 text-xs text-text font-mono placeholder:text-subtext0 focus:outline-none focus:border-surface2"
                    />
                  </div>
                </div>
              )}

              {/* Environment Variables (Key-Value) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-medium text-subtext0">
                    Environment Variables
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setServerEnvPairs([...serverEnvPairs, { key: '', value: '' }])
                    }
                    className="flex items-center gap-1 text-[10px] text-subtext0 hover:text-text px-2 py-0.5  hover:bg-surface1 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Variable</span>
                  </button>
                </div>

                <p className="text-[10px] text-subtext0 mb-2">
                  Secret-named variables are stored in your OS keychain and never included in preferences or exports. Leave a saved secret blank to keep it unchanged; enter a new value to replace it.
                </p>

                {serverEnvPairs.length > 0 ? (
                  <div className="space-y-1.5">
                    {serverEnvPairs.map((pair, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={pair.key}
                          onChange={(e) => {
                            const copy = [...serverEnvPairs];
                            copy[idx].key = e.target.value;
                            setServerEnvPairs(copy);
                          }}
                          placeholder="VARIABLE_NAME"
                          className="flex-1 px-2.5 py-1 bg-base border border-surface1 text-xs text-text font-mono placeholder:text-subtext0 focus:outline-none"
                        />
                        <input
                          type={isSecretMcpEnvName(pair.key) || isLikelySecretMcpEnvValue(pair.value) || pair.secretConfigured ? 'password' : 'text'}
                          value={pair.value}
                          onChange={(e) => {
                            const copy = [...serverEnvPairs];
                            copy[idx].value = e.target.value;
                            setServerEnvPairs(copy);
                          }}
                          placeholder={pair.secretConfigured && pair.savedKey === pair.key ? 'Saved in OS Keychain · blank keeps current value' : 'value'}
                          className="flex-1 px-2.5 py-1 bg-base border border-surface1 text-xs text-text font-mono placeholder:text-subtext0 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setServerEnvPairs(serverEnvPairs.filter((_, i) => i !== idx));
                          }}
                          className="p-1 text-subtext0 hover:text-red  cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-2 bg-base/40 border border-surface1/60 text-[11px] text-subtext0 italic">
                    No custom environment variables configured.
                  </div>
                )}
              </div>

              {/* Form Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface1/60">
                <button
                  type="button"
                  onClick={() => setIsServerFormOpen(false)}
                  className="px-3 py-1.5  border border-surface1 hover:bg-surface1 text-subtext0 hover:text-text text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-brand hover:bg-brand/90 text-on-accent text-xs font-semibold  transition-colors cursor-pointer shadow-md shadow-brand/20 border border-brand flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5 text-on-accent" />
                  <span>{editingServerId ? 'Save Changes' : 'Register Server'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Servers Cards List */}
          <div className="space-y-2.5">
            {mcpServers.length === 0 ? (
              <div className="p-8 border border-dashed border-surface1 text-center space-y-2.5">
                <div className="w-10 h-10 bg-surface0 flex items-center justify-center mx-auto text-subtext0">
                  <Cable className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-text">No MCP Servers Configured</h4>
                  <p className="text-[11px] text-subtext0 max-w-sm mx-auto mt-0.5">
                    Model Context Protocol servers allow your AI to read local files, execute Git diffs,
                    and interact with repositories.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenAddServer(MCP_PRESET_TEMPLATES[0])}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-surface1 hover:bg-surface2 text-text text-xs font-semibold  transition-colors cursor-pointer border border-surface2 shadow-xs mt-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Default Git MCP Server</span>
                </button>
              </div>
            ) : (
              mcpServers.map((server) => {
                const envCount = Object.keys(server.env).length;
                return (
                  <div
                    key={server.id}
                    className={`p-3.5 border transition-all space-y-2.5 ${
                      server.enabled
                        ? 'bg-surface0/30 border-surface0 hover:border-surface1'
                        : 'bg-surface0/10 border-surface0/40 opacity-70'
                    }`}
                  >
                    <div className="flex flex-wrap items-start gap-3">
                      <div className="flex min-w-0 flex-1 items-start gap-2.5">
                        <div
                          className={`w-8 h-8 shrink-0 border flex items-center justify-center text-text shadow-xs ${
                            server.enabled
                              ? 'bg-surface1 border-surface2'
                              : 'bg-surface0 border-surface0 text-subtext0'
                          }`}
                        >
                          <Cable className="w-4 h-4 text-subtext0" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-text">{server.name}</span>
                            <span className="text-[10px] px-2 py-0.2 bg-surface1 text-subtext0 border border-surface2 font-mono uppercase">
                              {server.type}
                            </span>

                            {envCount > 0 && (
                              <span className="text-[10px] px-1.5 py-0.2 bg-surface0 text-subtext1 border border-surface1 font-mono">
                                {envCount} env var{envCount > 1 ? 's' : ''}
                              </span>
                            )}

                            {server.testStatus === 'unavailable' && (
                              <span className="text-[10px] px-1.5 py-0.2 bg-surface1 text-text border border-surface2 font-mono flex items-center gap-1">
                                <span>Not connected</span>
                              </span>
                            )}
                          </div>

                          {server.description && (
                            <p className="text-[11px] text-subtext0 mt-0.5 line-clamp-1">
                              {server.description}
                            </p>
                          )}
                          <p className="text-[11px] text-subtext0 mt-1" role="status">
                            {server.testMessage || 'Not attached to harness. Use the external connectors panel for explicit HTTP discovery.'}
                          </p>
                        </div>
                      </div>

                      {/* Server Controls */}
                      <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                        {/* Enable/Disable Toggle */}
                        <button
                          type="button"
                          onClick={() => toggleMcpServer(server.id)}
                          className={`shrink-0 whitespace-nowrap px-2 py-1  text-[11px] font-semibold border transition-all cursor-pointer ${
                            server.enabled
                              ? 'bg-surface1 border-surface2 text-text shadow-xs'
                              : 'bg-surface0/50 border-surface0 text-subtext0 hover:text-text'
                          }`}
                          title="Saved preference only; this does not start or connect an MCP server"
                        >
                          {server.enabled ? 'Configured on' : 'Configured off'}
                        </button>

                        {/* Ping / Test Handshake */}
                        <button
                          type="button"
                          onClick={() => handleTestServer(server.id)}
                          disabled={testingServerId === server.id}
                          className="p-1.5  border border-surface1 hover:bg-surface1 text-subtext0 hover:text-text transition-colors cursor-pointer"
                          title="Validate saved configuration only. Use the external connectors panel for HTTP discovery."
                        >
                          <RefreshCw
                            className={`w-3.5 h-3.5 ${
                              testingServerId === server.id ? 'animate-spin text-text' : ''
                            }`}
                          />
                        </button>

                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={() => handleOpenEditServer(server)}
                          className="p-1.5  border border-surface1 hover:bg-surface1 text-subtext0 hover:text-text transition-colors cursor-pointer"
                          title="Edit Server Configuration"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete Button */}
                        {deletingServerId === server.id ? (
                          <div className="flex items-center gap-1 bg-surface1 p-0.5 border border-red/40">
                            <button
                              type="button"
                              onClick={() => {
                                deleteMcpServer(server.id);
                                setDeletingServerId(null);
                              }}
                              className="px-2 py-0.5 bg-red/20 hover:bg-red/30 text-red text-[11px] font-medium  transition-colors cursor-pointer"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingServerId(null)}
                              className="px-1.5 py-0.5 text-subtext0 hover:text-text text-[11px]  transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDeletingServerId(server.id)}
                            className="p-1.5  border border-surface1 hover:bg-red/10 text-subtext0 hover:text-red transition-colors cursor-pointer"
                            title="Remove MCP Server"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Command or URL Representation */}
                    <div className="p-2 bg-base/50 border border-surface0 flex items-center justify-between text-[11px] font-mono">
                      <div className="flex items-center gap-2 truncate text-subtext0">
                        {server.type === 'stdio' ? (
                          <>
                            <Terminal className="w-3 h-3 text-subtext0 shrink-0" />
                            <span className="text-text font-bold">{server.command}</span>
                            <span className="truncate">{server.args.join(' ')}</span>
                          </>
                        ) : (
                          <>
                            <Globe className="w-3 h-3 text-subtext0 shrink-0" />
                            <span className="text-text font-bold">{server.url}</span>
                          </>
                        )}
                      </div>

                      {server.lastTestedAt && (
                        <span className="text-[10px] text-subtext0/70 shrink-0 pl-2">
                          Checked {server.lastTestedAt}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: STAGE0 MANAGED ROLE PROMPTS */}
      {activeSubTab === 'prompts' && (
        <div className="space-y-4 animate-in fade-in duration-100">
          <div className="space-y-3">
            <div>
              <h3 className="text-xs font-semibold text-text">Stage0 system prompts</h3>
              <p className="text-[11px] text-subtext0 mt-1">
                These role prompts are built into Stage0 and read-only. A reviewer bot selects one by role; custom bots can add separate instructions in the Reviewer Bots tab.
              </p>
            </div>
            <div className="max-w-sm">
              <label className="block text-[11px] font-semibold text-subtext0 mb-1">Preview role</label>
              <CustomSelect
                value={promptPreviewRole}
                options={PROMPT_ROLE_OPTIONS}
                onChange={setPromptPreviewRole}
                className="w-full"
                buttonClassName="w-full"
                dropdownWidth="w-full"
                align="left"
                aria-label="System prompt role preview"
              />
            </div>
            <pre className="w-full max-h-[28rem] overflow-y-auto whitespace-pre-wrap p-3 bg-base border border-surface1 text-xs text-subtext1 font-mono leading-relaxed select-text">
              {getBotRolePrompt(promptPreviewRole)}
            </pre>
            <div>
              <label className="block text-[11px] font-semibold text-subtext0 mb-1">
                Additional Instructions for Global AI Reviews <span className="font-normal">(optional)</span>
              </label>
              <p className="text-[10px] text-subtext0 mb-2">
                This text supplements the read-only General Reviewer prompt when a review uses Global AI Preferences. Reviewer bots keep their own instructions in the Reviewer Bots tab.
              </p>
              <textarea
                rows={5}
                value={aiConfig.reviewerInstructions}
                onChange={(event) => updateAiConfig({ reviewerInstructions: event.target.value })}
                placeholder="Add extra guidance for reviews started with Global AI Preferences..."
                className="w-full p-3 bg-base border border-surface1 text-xs text-text font-mono leading-relaxed placeholder:text-subtext0 focus:outline-none focus:border-surface2 select-text"
              />
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT LLM PROVIDER */}
      {isProviderSetupOpen && (
        <div className="fixed inset-x-0 bottom-0 top-8.5 z-60 bg-[var(--backdrop-modal)] backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleSaveProviderSetup} className="bg-mantle border border-surface0 w-full max-w-xl shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div data-tauri-drag-region className="flex items-center justify-between pb-2 border-b border-surface0 cursor-default">
              <div data-tauri-drag-region className="flex items-center gap-2 pointer-events-none">
                <Sparkles className="w-4 h-4 text-brand" />
                <span>
                  <h4 className="text-sm font-bold text-text">Add LLM provider</h4>
                  <span className="block text-[10px] text-subtext0 mt-0.5">Choose a provider and save its connection details.</span>
                </span>
              </div>
              <button type="button" onClick={() => setIsProviderSetupOpen(false)} className="p-1 text-subtext0 hover:text-text  cursor-pointer" aria-label="Close provider form">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label htmlFor="llm-provider-select" className="block text-[11px] font-semibold text-subtext0 mb-1">Provider</label>
                <select
                  id="llm-provider-select"
                  value={setupProviderId}
                  onChange={(event) => loadProviderSetup(event.target.value as AiProviderId)}
                  className="w-full px-3 py-2 bg-base border border-surface1 text-xs text-text focus:outline-none focus:border-surface2"
                >
                  {availableProviderList.map((provider) => <option key={provider.id} value={provider.id}>{getProviderDisplayName(provider.id)}</option>)}
                </select>
              </div>

              {setupProviderId === 'custom' && (
                <div>
                  <label htmlFor="llm-provider-name" className="block text-[11px] font-semibold text-subtext0 mb-1">Display name</label>
                  <input
                    id="llm-provider-name"
                    value={setupProviderName}
                    onChange={(event) => setSetupProviderName(event.target.value)}
                    placeholder="e.g. OpenRouter, DeepSeek, LM Studio"
                    className="w-full px-3 py-2 bg-base border border-surface1 text-xs text-text placeholder:text-subtext0 focus:outline-none focus:border-surface2"
                  />
                </div>
              )}

              {setupProviderId !== 'ollama' && (
                <div>
                  <label htmlFor="llm-provider-api-key" className="block text-[11px] font-semibold text-subtext0 mb-1">API key</label>
                  <input
                    id="llm-provider-api-key"
                    type="password"
                    autoComplete="new-password"
                    value={setupApiKey}
                    onChange={(event) => setSetupApiKey(event.target.value)}
                    placeholder={hasProviderApiKey(setupProviderId) ? 'Saved securely · leave empty to keep' : 'Paste your API key'}
                    className="w-full px-3 py-2 bg-base border border-surface1 text-xs text-text placeholder:text-subtext0 focus:outline-none focus:border-surface2"
                  />
                  <p className="text-[9px] text-subtext0 mt-1">On Apply, the key is saved securely and never written to preferences.json.</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="llm-provider-base-url" className="block text-[11px] font-semibold text-subtext0 mb-1">API base URL</label>
                  <input
                    id="llm-provider-base-url"
                    type="url"
                    value={setupBaseUrl}
                    onChange={(event) => setSetupBaseUrl(event.target.value)}
                    placeholder="https://api.example.com/v1"
                    className="w-full px-3 py-2 bg-base border border-surface1 text-xs text-text placeholder:text-subtext0 focus:outline-none focus:border-surface2"
                  />
                </div>
                <div>
                  <label htmlFor="llm-provider-model" className="block text-[11px] font-semibold text-subtext0 mb-1">Model ID</label>
                  <input
                    id="llm-provider-model"
                    value={setupModel}
                    onChange={(event) => setSetupModel(event.target.value)}
                    placeholder="model-name"
                    className="w-full px-3 py-2 bg-base border border-surface1 text-xs text-text placeholder:text-subtext0 focus:outline-none focus:border-surface2"
                  />
                </div>
              </div>
            </div>

            {providerSetupError && (
              <div role="alert" className="flex items-center gap-2 p-2.5 bg-red/10 border border-red/30 text-red text-[11px]">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{providerSetupError}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-surface0">
              <button type="button" onClick={() => setIsProviderSetupOpen(false)} className="px-3 py-1.5 border border-surface1 text-subtext0 hover:text-text hover:bg-surface0 text-xs transition cursor-pointer">
                Cancel
              </button>
              <button type="submit" className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-brand text-base text-xs font-semibold hover:brightness-110 transition cursor-pointer">
                <Check className="w-3.5 h-3.5" />
                <span>Save provider</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {providerToDelete && (
        <div className="fixed inset-x-0 bottom-0 top-8.5 z-60 bg-[var(--backdrop-modal)] backdrop-blur-xs flex items-center justify-center p-4">
          <div role="alertdialog" aria-modal="true" aria-labelledby="remove-provider-title" className="w-full max-w-md bg-mantle border border-surface0 shadow-2xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <span className="w-9 h-9 shrink-0 border border-red/40 bg-red/10 text-red flex items-center justify-center">
                <Trash2 className="w-4 h-4" />
              </span>
              <div>
                <h4 id="remove-provider-title" className="text-sm font-bold text-text">Remove {getProviderDisplayName(providerToDelete)}?</h4>
                <p className="text-[11px] leading-relaxed text-subtext0 mt-1">
                  This removes its provider entry and all saved connection settings. The saved API key in the OS credential store will also be deleted. In Preferences, the removal takes effect when you apply your changes.
                </p>
              </div>
            </div>

            {providerDeleteError && (
              <div role="alert" className="flex items-center gap-2 p-2.5 bg-red/10 border border-red/30 text-red text-[11px]">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{providerDeleteError}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-surface0">
              <button type="button" disabled={isDeletingProvider} onClick={() => setProviderToDelete(null)} className="px-3 py-1.5 border border-surface1 text-subtext0 hover:text-text hover:bg-surface0 text-xs transition cursor-pointer disabled:opacity-50">
                Cancel
              </button>
              <button type="button" disabled={isDeletingProvider} onClick={() => void confirmRemoveProvider()} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red text-base text-xs font-semibold hover:brightness-110 transition cursor-pointer disabled:opacity-50">
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeletingProvider ? 'Removing…' : 'Remove provider'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: IMPORT / EXPORT MCP CONFIG JSON */}
      {isJsonModalOpen && (
        <div className="fixed inset-x-0 bottom-0 top-8.5 z-60 bg-[var(--backdrop-modal)] backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-mantle border border-surface0 w-full max-w-2xl shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div
              data-tauri-drag-region
              className="flex items-center justify-between pb-2 border-b border-surface0 cursor-default"
            >
              <div data-tauri-drag-region className="flex items-center gap-2 pointer-events-none">
                <FileJson className="w-4 h-4 text-subtext0" />
                <h4 className="text-sm font-bold text-text">MCP JSON Configuration</h4>
              </div>
              <button
                type="button"
                onClick={() => setIsJsonModalOpen(false)}
                className="p-1 text-subtext0 hover:text-text  cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Sub-tab: Export vs Import */}
            <div className="flex items-center gap-2 border-b border-surface0 pb-2">
              <button
                type="button"
                onClick={() => {
                  setJsonTab('export');
                  setJsonFeedback(null);
                }}
                className={`px-3 py-1.5 text-xs font-semibold cursor-pointer border ${
                  jsonTab === 'export'
                    ? 'bg-surface1 border-surface2 text-text'
                    : 'border-transparent text-subtext0 hover:text-text'
                }`}
              >
                Export JSON (Claude Desktop / VSCode compatible)
              </button>
              <button
                type="button"
                onClick={() => {
                  setJsonTab('import');
                  setJsonFeedback(null);
                }}
                className={`px-3 py-1.5 text-xs font-semibold cursor-pointer border ${
                  jsonTab === 'import'
                    ? 'bg-surface1 border-surface2 text-text'
                    : 'border-transparent text-subtext0 hover:text-text'
                }`}
              >
                Import JSON
              </button>
            </div>

            {jsonTab === 'export' ? (
              <div className="space-y-3">
                <p className="text-[11px] text-subtext0">
                  Copy this JSON into your <code>claude_desktop_config.json</code> or VS Code MCP
                  configuration to synchronize servers:
                </p>
                <pre className="p-3 bg-base border border-surface0 text-xs font-mono overflow-auto max-h-60 text-text select-all">
                  {exportMcpConfigFile()}
                </pre>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleCopyJson}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-surface1 hover:bg-surface2 text-text text-xs font-semibold  transition-colors cursor-pointer border border-surface2 shadow-xs"
                  >
                    {copiedJson ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-text" />
                        <span className="text-text">Copied to Clipboard!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy JSON</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-[11px] text-subtext0">
                  Paste standard <code>{`{ "mcpServers": { ... } }`}</code> configuration to import
                  servers directly into Stage0:
                </p>
                <textarea
                  rows={8}
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  placeholder={`{\n  "mcpServers": {\n    "filesystem": {\n      "command": "npx",\n      "args": ["-y", "@modelcontextprotocol/server-filesystem", "."]\n    }\n  }\n}`}
                  className="w-full p-3 bg-base border border-surface1 text-xs text-text font-mono placeholder:text-subtext0 focus:outline-none focus:border-surface2"
                />

                {jsonFeedback && (
                  <div
                    className={`p-2.5 border text-xs flex items-center gap-2 ${
                      jsonFeedback.success
                        ? 'bg-surface1 border-surface2 text-text'
                        : 'bg-surface1 border-surface2 text-subtext0'
                    }`}
                  >
                    {jsonFeedback.success ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0" />
                    )}
                    <span>{jsonFeedback.text}</span>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsJsonModalOpen(false)}
                    className="px-3 py-1.5  border border-surface1 hover:bg-surface1 text-subtext0 hover:text-text text-xs transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleImportJson}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-surface1 hover:bg-surface2 text-text text-xs font-semibold  transition-colors cursor-pointer border border-surface2 shadow-xs"
                  >
                    <Check className="w-3.5 h-3.5 text-text" />
                    <span>Import Config</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
