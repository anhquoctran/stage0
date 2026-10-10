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
import { Code2 } from '../../../common/components/icons/Code2';
import { Zap } from '../../../common/components/icons/Zap';
import { HardDrive } from '../../../common/components/icons/HardDrive';
import { Cog } from '../../../common/components/icons/Cog';
import { CustomSelect } from '../../../common/components/CustomSelect';
import type { CustomSelectOption } from '../../../common/types/CustomSelectOption';
import { useAiMcpStore } from '../store/useAiMcpStore';
import { AI_PROVIDERS, MCP_PRESET_TEMPLATES, DEFAULT_AI_CONFIG } from '../constants/aiPresets';
import { type AiConfig } from '../types/AiConfig';
import { type AiProviderId } from '../types/AiProviderId';
import { type McpServerConfig } from '../types/McpServerConfig';
import { type McpServerType } from '../types/McpServerType';
import type { AiMcpTabProps } from '../types/AiMcpTabProps';

const MAX_TOKEN_OPTIONS: CustomSelectOption<string>[] = [
  { value: '1024', label: '1,024 Tokens (Compact)' },
  { value: '2048', label: '2,048 Tokens (Standard)' },
  { value: '4096', label: '4,096 Tokens (Recommended for Diffs)' },
  { value: '8192', label: '8,192 Tokens (Large MR Review)' },
  { value: '16384', label: '16,384 Tokens (Deep Reasoning / Extended)' },
];

const MCP_SERVER_TYPE_OPTIONS: CustomSelectOption<McpServerType>[] = [
  { value: 'stdio', label: 'stdio (Command / Subprocess)' },
  { value: 'sse', label: 'sse (HTTP Server-Sent Events)' },
];

const getProviderIcon = (providerId: string) => {
  switch (providerId) {
    case 'openai':
      return Sparkles;
    case 'anthropic':
      return Bot;
    case 'github_copilot':
      return Code2;
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
  draftAiConfig,
  onUpdateAiConfig,
  onNavigateToGuardrails,
  activeView,
  onBackToOverview,
}) => {
  const {
    aiConfig: storeAiConfig,
    apiKeysConfigured,
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
    copilotStatus,
    googleAuthStatus,
    cliStatus,
    isDetectingCli,
    isConnectingSubscription,
    copilotDeviceCode,
    detectCli,
    executeCliTest,
    startCopilotFlow,
    pollCopilotToken,
    checkCopilotStatus,
    disconnectCopilot,
    startGoogleOAuth,
    checkGoogleAuthStatus,
    disconnectGoogleOAuth,
    clearCopilotDeviceCode,
    dynamicModels,
    fetchDynamicModels,
    chatgptAuthStatus,
    startChatGptOAuth,
    checkChatGptAuthStatus,
    disconnectChatGptOAuth,
    addMcpServer,
    updateMcpServer,
    deleteMcpServer,
    toggleMcpServer,
    testMcpServer,
    importMcpConfigFile,
    exportMcpConfigFile,
  } = useAiMcpStore();

  const aiConfig = draftAiConfig || storeAiConfig;
  const updateAiConfig = onUpdateAiConfig || storeUpdateAiConfig;
  const setProvider = (providerId: AiConfig['provider']) => {
    const preset = AI_PROVIDERS.find((p) => p.id === providerId) || AI_PROVIDERS[0];
    const defaultAuthMode: AiConfig['authMode'] =
      providerId === 'github_copilot'
        ? 'subscription_oauth'
        : providerId === 'openai' && chatgptAuthStatus?.connected
        ? 'subscription_oauth'
        : providerId === 'anthropic' && cliStatus.claude?.available
        ? 'cli_bridge'
        : providerId === 'xai_grok' && cliStatus.grok?.available
        ? 'cli_bridge'
        : 'api_key';

    if (onUpdateAiConfig) {
      onUpdateAiConfig({
        provider: providerId,
        authMode: defaultAuthMode,
        model: preset.defaultModel,
        baseUrl: preset.defaultBaseUrl,
        apiKey: '',
      });
    } else {
      storeSetProvider(providerId);
      storeUpdateAiConfig({ authMode: defaultAuthMode });
    }
  };

  const resetAiConfig = () => {
    if (onUpdateAiConfig) {
      onUpdateAiConfig(DEFAULT_AI_CONFIG);
    } else {
      storeResetAiConfig();
    }
  };

  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyDraft, setApiKeyDraft] = useState(draftAiConfig?.apiKey || '');
  const [testingServerId, setTestingServerId] = useState<string | null>(null);
  const [deletingServerId, setDeletingServerId] = useState<string | null>(null);

  // Cloud Subscription & CLI Bridge UI State
  const [testingCliType, setTestingCliType] = useState<string | null>(null);
  const [cliTestOutput, setCliTestOutput] = useState<{ [key: string]: string }>({});
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    if (!copilotDeviceCode) return;
    const interval = setInterval(async () => {
      const res = await pollCopilotToken(copilotDeviceCode.device_code);
      if (res.status === 'authorized' || res.status === 'expired' || res.status === 'denied') {
        clearInterval(interval);
      }
    }, (copilotDeviceCode.interval || 5) * 1000);
    return () => clearInterval(interval);
  }, [copilotDeviceCode, pollCopilotToken]);

  useEffect(() => {
    void checkCopilotStatus();
    void checkGoogleAuthStatus();
    void checkChatGptAuthStatus();
    void detectCli('claude');
    void detectCli('grok');
  }, [checkCopilotStatus, checkGoogleAuthStatus, checkChatGptAuthStatus, detectCli]);

  useEffect(() => {
    void fetchDynamicModels(aiConfig.provider);
  }, [aiConfig.provider, fetchDynamicModels]);

  // Add / Edit Server Form State
  const [isServerFormOpen, setIsServerFormOpen] = useState(false);
  const [editingServerId, setEditingServerId] = useState<string | null>(null);
  const [serverName, setServerName] = useState('');
  const [serverDesc, setServerDesc] = useState('');
  const [serverType, setServerType] = useState<McpServerType>('stdio');
  const [serverCommand, setServerCommand] = useState('');
  const [serverArgsStr, setServerArgsStr] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [serverEnvPairs, setServerEnvPairs] = useState<{ key: string; value: string }[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  // Import / Export JSON Dialog State
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
  const [jsonTab, setJsonTab] = useState<'export' | 'import'>('export');
  const [jsonInput, setJsonInput] = useState('');
  const [jsonFeedback, setJsonFeedback] = useState<{ success?: boolean; text: string } | null>(null);
  const [copiedJson, setCopiedJson] = useState(false);

  const activeProviderPreset =
    AI_PROVIDERS.find((p) => p.id === aiConfig.provider) || AI_PROVIDERS[0];
  const hasSavedApiKey = !!apiKeysConfigured[aiConfig.provider];

  useEffect(() => {
    setApiKeyDraft(draftAiConfig?.apiKey || '');
  }, [aiConfig.provider, draftAiConfig?.apiKey]);

  useEffect(() => {
    void loadApiKeyForProvider(aiConfig.provider);
  }, [aiConfig.provider, loadApiKeyForProvider]);

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
      Object.entries(server.env).map(([k, v]) => ({ key: k, value: v }))
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

    if (serverType === 'sse' && !serverUrl.trim()) {
      setFormError('SSE endpoint URL is required');
      return;
    }

    // Convert args string to array (split by space but preserve quoted tokens if simple)
    const parsedArgs = serverArgsStr
      .trim()
      .split(/\s+/)
      .filter((s) => s.length > 0);

    const envMap: Record<string, string> = {};
    for (const pair of serverEnvPairs) {
      if (pair.key.trim()) {
        envMap[pair.key.trim()] = pair.value.trim();
      }
    }

    if (editingServerId) {
      updateMcpServer(editingServerId, {
        name: serverName.trim(),
        description: serverDesc.trim() || undefined,
        type: serverType,
        command: serverCommand.trim(),
        args: parsedArgs,
        url: serverType === 'sse' ? serverUrl.trim() : undefined,
        env: envMap,
      });
    } else {
      addMcpServer({
        name: serverName.trim(),
        description: serverDesc.trim() || undefined,
        type: serverType,
        command: serverCommand.trim(),
        args: parsedArgs,
        url: serverType === 'sse' ? serverUrl.trim() : undefined,
        env: envMap,
        enabled: true,
      });
    }

    setIsServerFormOpen(false);
  };

  const handleTestServer = async (id: string) => {
    setTestingServerId(id);
    await testMcpServer(id);
    setTestingServerId(null);
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

  const isSubscriptionMode =
    aiConfig.authMode === 'subscription_oauth' || aiConfig.authMode === 'cli_bridge';

  const defaultSubMode = activeProviderPreset.supportedAuthModes?.includes('subscription_oauth')
    ? 'subscription_oauth'
    : 'cli_bridge';

  const isProviderConfigured = (id: string) => {
    if (id === 'openai') {
      return chatgptAuthStatus?.connected || !!apiKeysConfigured['openai'];
    }
    if (id === 'github_copilot') {
      return !!copilotStatus?.connected;
    }
    if (id === 'gemini') {
      return googleAuthStatus?.connected || !!apiKeysConfigured['gemini'];
    }
    if (id === 'anthropic') {
      return (aiConfig.authMode === 'cli_bridge' && !!cliStatus.claude?.available) || !!apiKeysConfigured['anthropic'];
    }
    if (id === 'xai_grok') {
      return (aiConfig.authMode === 'cli_bridge' && !!cliStatus.grok?.available) || !!apiKeysConfigured['xai_grok'];
    }
    if (id === 'ollama') {
      return true;
    }
    return !!apiKeysConfigured[id as AiProviderId];
  };

  const getProviderDisplayName = (id: string) => {
    switch (id) {
      case 'openai': return 'OpenAI / ChatGPT';
      case 'anthropic': return 'Anthropic Claude';
      case 'github_copilot': return 'GitHub Copilot';
      case 'gemini': return 'Google Gemini';
      case 'xai_grok': return 'SuperGrok';
      case 'ollama': return 'Ollama (Local)';
      case 'custom': return 'Custom Endpoint';
      default: return id;
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
              Active: {activeProviderPreset.name} • {aiConfig.model}
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
              <span>Reviewer Persona & Prompts</span>
            </button>
          </div>
        </div>
      )}

      {/* VIEW: AI MODEL & PROVIDER CONFIGURATION */}
      {(activeView === 'providers' || (!activeView && (activeSubTab === 'ai' || activeSubTab === 'guardrails'))) && (
        <div className="space-y-4 animate-in fade-in duration-100">
          {/* Provider Selector: Flex wrap pills with full names */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-text uppercase tracking-wider">
                Select Provider
              </span>
              <span className="text-[10px] text-subtext0 font-mono">
                {activeProviderPreset.name} active
              </span>
            </div>

            <div className="flex flex-wrap gap-2 p-1.5 bg-base/70 border border-surface1 rounded-xl">
              {AI_PROVIDERS.map((p) => {
                const isSelected = aiConfig.provider === p.id;
                const ProviderIcon = getProviderIcon(p.id);
                const connected = isProviderConfigured(p.id);

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setProvider(p.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer select-none whitespace-nowrap ${
                      isSelected
                        ? 'bg-surface1 text-text font-bold shadow-xs border border-surface2 ring-1 ring-surface2'
                        : 'text-subtext0 hover:text-text hover:bg-surface0/60 border border-transparent'
                    }`}
                  >
                    <ProviderIcon className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-brand' : 'text-subtext0'}`} />
                    <span className="whitespace-nowrap">{getProviderDisplayName(p.id)}</span>
                    {connected ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-green shrink-0" title="Connected / Configured" />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-surface2 shrink-0 opacity-30" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Unified Settings Card for Active Provider */}
          <div className="p-4 bg-surface0/30 border border-surface1 rounded-xl space-y-4">
            {/* Header: Active Provider Info & Docs */}
            <div className="flex items-center justify-between pb-3 border-b border-surface1/60">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-surface1 border border-surface2 flex items-center justify-center text-brand shrink-0">
                  <ActiveProviderIcon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-text">{activeProviderPreset.name}</h4>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-surface1 text-subtext0 border border-surface2 font-mono shrink-0">
                      {aiConfig.provider === 'ollama'
                        ? 'Offline Local'
                        : isSubscriptionMode
                        ? 'Subscription / CLI'
                        : 'API Key'}
                    </span>
                  </div>
                  <p className="text-[11px] text-subtext0 mt-0.5">{activeProviderPreset.description}</p>
                </div>
              </div>

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
                  className="flex items-center gap-1 text-[11px] text-subtext0 hover:text-text underline cursor-pointer shrink-0 ml-3"
                >
                  <span>Documentation</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            {/* SECTION 1: AUTHENTICATION / ACCESS */}
            <div className="space-y-2.5">
              {/* Connection Option Switch (when provider supports both Subscription and API Key) */}
              {activeProviderPreset.supportedAuthModes && activeProviderPreset.supportedAuthModes.length > 1 && (
                <div className="flex items-center justify-between p-2.5 bg-base/50 border border-surface1 rounded-lg">
                  <div>
                    <div className="text-xs font-semibold text-text">Connection Option</div>
                    <div className="text-[10px] text-subtext0">
                      {isSubscriptionMode
                        ? 'Included in your subscription plan (No token charges)'
                        : 'Standard pay-per-token developer API key'}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 p-0.5 bg-surface0 border border-surface1 rounded-md shrink-0">
                    <button
                      type="button"
                      onClick={() => updateAiConfig({ authMode: defaultSubMode })}
                      className={`px-3 py-1 rounded text-xs transition-all cursor-pointer font-medium ${
                        isSubscriptionMode ? 'bg-surface2 text-text font-semibold shadow-xs' : 'text-subtext0 hover:text-text'
                      }`}
                    >
                      Subscription / CLI
                    </button>
                    <button
                      type="button"
                      onClick={() => updateAiConfig({ authMode: 'api_key' })}
                      className={`px-3 py-1 rounded text-xs transition-all cursor-pointer font-medium ${
                        !isSubscriptionMode ? 'bg-surface2 text-text font-semibold shadow-xs' : 'text-subtext0 hover:text-text'
                      }`}
                    >
                      API Key
                    </button>
                  </div>
                </div>
              )}

              {/* Sub-panels for Auth Modes */}
              {aiConfig.provider === 'openai' && isSubscriptionMode ? (
                <div className="p-3 bg-base/60 border border-surface1 rounded-lg">
                  {chatgptAuthStatus?.connected ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-text">
                        <CheckCircle2 className="w-4 h-4 text-green shrink-0" />
                        <span>Signed in as <strong className="font-mono text-text">{chatgptAuthStatus.account_email || 'ChatGPT Subscriber'}</strong></span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-green/10 text-green border border-green/20 font-mono">
                          ChatGPT Plus / Pro
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => void disconnectChatGptOAuth()}
                        className="px-2.5 py-1 rounded bg-red/10 hover:bg-red/20 text-[11px] text-red border border-red/30 transition-colors cursor-pointer"
                      >
                        Sign Out
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-[11px] text-subtext0">
                        Connect your ChatGPT Plus or Pro subscription via secure OAuth 2.0 PKCE.
                      </p>
                      <button
                        type="button"
                        onClick={() => void startChatGptOAuth()}
                        disabled={isConnectingSubscription}
                        className="px-3 py-1.5 rounded bg-surface1 hover:bg-surface2 text-text text-xs border border-surface2 font-medium cursor-pointer shrink-0 disabled:opacity-50"
                      >
                        {isConnectingSubscription ? 'Connecting...' : 'Sign In with ChatGPT'}
                      </button>
                    </div>
                  )}
                </div>
              ) : aiConfig.provider === 'github_copilot' ? (
                <div className="p-3 bg-base/60 border border-surface1 rounded-lg">
                  {copilotStatus?.connected ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-text">
                        <CheckCircle2 className="w-4 h-4 text-green shrink-0" />
                        <span>GitHub User: <strong className="font-mono text-text">{copilotStatus.username || 'Subscriber'}</strong></span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-green/10 text-green border border-green/20 font-mono">
                          Copilot Active
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => disconnectCopilot()}
                        className="px-2.5 py-1 rounded bg-red/10 hover:bg-red/20 text-[11px] text-red border border-red/30 transition-colors cursor-pointer"
                      >
                        Sign Out
                      </button>
                    </div>
                  ) : copilotDeviceCode ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-text">
                        <span>Device Authorization</span>
                        <button type="button" onClick={() => clearCopilotDeviceCode()} className="text-subtext0 hover:text-text cursor-pointer">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-surface0 border border-surface2 rounded">
                        <span className="text-base font-mono font-bold tracking-widest text-brand">{copilotDeviceCode.user_code}</span>
                        <button
                          type="button"
                          onClick={() => {
                            void navigator.clipboard.writeText(copilotDeviceCode.user_code);
                            void openUrlInBrowser(copilotDeviceCode.verification_uri);
                          }}
                          className="px-2.5 py-1 rounded bg-brand hover:bg-brand/90 text-on-accent font-bold text-xs flex items-center gap-1 cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                          <span>Copy &amp; Open GitHub</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-[11px] text-subtext0">
                        Authorize your GitHub Copilot subscription via device code flow.
                      </p>
                      <button
                        type="button"
                        onClick={() => startCopilotFlow()}
                        disabled={isConnectingSubscription}
                        className="px-3 py-1.5 rounded bg-surface1 hover:bg-surface2 text-text text-xs border border-surface2 font-medium cursor-pointer shrink-0 disabled:opacity-50"
                      >
                        {isConnectingSubscription ? 'Connecting...' : 'Sign In with GitHub Copilot'}
                      </button>
                    </div>
                  )}
                </div>
              ) : aiConfig.provider === 'anthropic' && isSubscriptionMode ? (
                <div className="p-3 bg-base/60 border border-surface1 rounded-lg">
                  {cliStatus.claude?.available ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-text">
                        <CheckCircle2 className="w-4 h-4 text-green shrink-0" />
                        <span className="font-mono text-text">Claude Code CLI ({cliStatus.claude.version || 'Ready'})</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-green/10 text-green border border-green/20 font-mono">
                          Session Ready
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            setTestingCliType('claude');
                            const res = await executeCliTest('claude');
                            setCliTestOutput((prev) => ({ ...prev, claude: res.output }));
                            setTestingCliType(null);
                          }}
                          disabled={testingCliType === 'claude'}
                          className="px-2.5 py-1 rounded bg-brand/15 hover:bg-brand/25 text-[11px] text-brand border border-brand/40 cursor-pointer"
                        >
                          {testingCliType === 'claude' ? 'Testing...' : 'Test CLI'}
                        </button>
                        <button
                          type="button"
                          onClick={() => detectCli('claude')}
                          disabled={isDetectingCli}
                          className="px-2 py-1 rounded bg-surface1 hover:bg-surface2 text-[11px] text-subtext0 hover:text-text border border-surface2 cursor-pointer"
                        >
                          Re-scan
                        </button>
                      </div>
                      {cliTestOutput.claude && (
                        <div className="mt-2 p-2 bg-surface0 border border-surface1 rounded font-mono text-[10px] text-subtext1 max-h-24 overflow-y-auto whitespace-pre-wrap">
                          {cliTestOutput.claude}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <div>
                        <span className="text-yellow font-semibold">Claude Code CLI not found in PATH.</span>
                        <span className="text-subtext0 block text-[11px]">Run: <code className="font-mono text-text">npm i -g @anthropic-ai/claude-code</code> then <code className="font-mono text-text">claude login</code></span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard.writeText('npm install -g @anthropic-ai/claude-code');
                          setCopiedCode(true);
                          setTimeout(() => setCopiedCode(false), 2000);
                        }}
                        className="px-2.5 py-1 rounded bg-surface1 hover:bg-surface2 text-text text-xs border border-surface2 cursor-pointer shrink-0"
                      >
                        {copiedCode ? 'Copied!' : 'Copy Install Command'}
                      </button>
                    </div>
                  )}
                </div>
              ) : aiConfig.provider === 'gemini' && isSubscriptionMode ? (
                <div className="p-3 bg-base/60 border border-surface1 rounded-lg">
                  {googleAuthStatus?.connected ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-text">
                        <CheckCircle2 className="w-4 h-4 text-green shrink-0" />
                        <span>Google Account: <strong className="font-mono text-text">{googleAuthStatus.account_email || 'Connected'}</strong></span>
                      </div>
                      <button
                        type="button"
                        onClick={() => disconnectGoogleOAuth()}
                        className="px-2.5 py-1 rounded bg-red/10 hover:bg-red/20 text-[11px] text-red border border-red/30 cursor-pointer"
                      >
                        Sign Out
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-[11px] text-subtext0">
                        Sign in with Google One AI Premium / Gemini Advanced via secure OAuth.
                      </p>
                      <button
                        type="button"
                        onClick={() => startGoogleOAuth()}
                        disabled={isConnectingSubscription}
                        className="px-3 py-1.5 rounded bg-surface1 hover:bg-surface2 text-text text-xs border border-surface2 font-medium cursor-pointer shrink-0 disabled:opacity-50"
                      >
                        {isConnectingSubscription ? 'Connecting...' : 'Sign In with Google'}
                      </button>
                    </div>
                  )}
                </div>
              ) : aiConfig.provider === 'xai_grok' && isSubscriptionMode ? (
                <div className="p-3 bg-base/60 border border-surface1 rounded-lg">
                  {cliStatus.grok?.available ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-text">
                        <CheckCircle2 className="w-4 h-4 text-green shrink-0" />
                        <span className="font-mono text-text">SuperGrok CLI ({cliStatus.grok.version || 'Ready'})</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-green/10 text-green border border-green/20 font-mono">
                          SuperGrok
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            setTestingCliType('grok');
                            const res = await executeCliTest('grok', 'Explain what Stage0 is in one sentence.');
                            setCliTestOutput((prev) => ({ ...prev, grok: res.output }));
                            setTestingCliType(null);
                          }}
                          disabled={testingCliType === 'grok'}
                          className="px-2.5 py-1 rounded bg-brand/15 hover:bg-brand/25 text-[11px] text-brand border border-brand/40 cursor-pointer"
                        >
                          {testingCliType === 'grok' ? 'Testing...' : 'Test CLI'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void detectCli('grok')}
                          disabled={isDetectingCli}
                          className="px-2 py-1 rounded bg-surface1 hover:bg-surface2 text-[11px] text-subtext0 hover:text-text border border-surface2 cursor-pointer"
                        >
                          Re-scan
                        </button>
                      </div>
                      {cliTestOutput.grok && (
                        <div className="mt-2 p-2 bg-surface0 border border-surface1 rounded font-mono text-[10px] text-subtext1 max-h-24 overflow-y-auto whitespace-pre-wrap">
                          {cliTestOutput.grok}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <div>
                        <span className="text-yellow font-semibold">SuperGrok / GrokBuild CLI not detected.</span>
                        <span className="text-subtext0 block text-[11px]">Install SuperGrok CLI to use SuperGrok / X Premium+ subscription.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard.writeText('irm https://x.ai/cli/install.ps1 | iex');
                          setCopiedCode(true);
                          setTimeout(() => setCopiedCode(false), 2000);
                        }}
                        className="px-2.5 py-1 rounded bg-surface1 hover:bg-surface2 text-text text-xs border border-surface2 cursor-pointer shrink-0"
                      >
                        {copiedCode ? 'Copied!' : 'Copy Install Command'}
                      </button>
                    </div>
                  )}
                </div>
              ) : activeProviderPreset.requiresApiKey ? (
                /* Standard Developer API Key Field */
                <div className="p-3 bg-base/60 border border-surface1 rounded-lg">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-text">
                      API Secret Key <span className="text-red">*</span>
                    </label>
                    <span className="text-[10px] text-green/90 font-mono">
                      {hasSavedApiKey ? '✓ Stored securely in OS Keyring' : 'Saved in encrypted OS Keyring'}
                    </span>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={apiKeyDraft}
                      onChange={(e) => {
                        const value = e.target.value;
                        setApiKeyDraft(value);
                        if (onUpdateAiConfig) onUpdateAiConfig({ apiKey: value });
                      }}
                      onBlur={() => {
                        if (!onUpdateAiConfig && apiKeyDraft.trim()) {
                          storeUpdateAiConfig({ apiKey: apiKeyDraft });
                          setApiKeyDraft('');
                        }
                      }}
                      placeholder={
                        hasSavedApiKey
                          ? 'Key saved securely. Enter a new key to replace it.'
                          : 'sk-..., gsk_..., or developer token'
                      }
                      className="w-full px-3 pr-10 py-1.5 bg-base border border-surface1 text-xs text-text font-mono placeholder:text-subtext0 focus:outline-none focus:border-surface2 rounded"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-2.5 p-1 text-subtext0 hover:text-text cursor-pointer"
                      title={showApiKey ? 'Hide secret key' : 'Show secret key'}
                    >
                      {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              ) : (
                /* Ollama Local Informational Box */
                <div className="p-3 bg-base/60 border border-surface1 rounded-lg flex items-center gap-2.5 text-xs text-subtext0">
                  <ShieldCheck className="w-4 h-4 text-green shrink-0" />
                  <span>
                    Ollama runs offline on your local machine (http://localhost:11434). No API key or cloud subscription required.
                  </span>
                </div>
              )}
            </div>

            {/* SECTION 2: MODEL SELECTION & INFERENCE PARAMETERS */}
            {(() => {
              const currentDynamic = dynamicModels[aiConfig.provider];
              const modelsList = currentDynamic && currentDynamic.length > 0 ? currentDynamic : activeProviderPreset.models;
              const selectedModelInfo = modelsList.find((m) => m.id === aiConfig.model);
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
                    <label className="block text-xs font-semibold text-text mb-1.5">Model</label>
                    <CustomSelect
                      value={aiConfig.model}
                      options={modelOptions}
                      onChange={(model) => updateAiConfig({ model })}
                      className="w-full"
                      buttonClassName="w-full py-2 font-mono"
                      dropdownWidth="w-full"
                      align="left"
                      aria-label="Model"
                    />
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
                        className="w-full h-1.5 bg-surface1 appearance-none cursor-pointer accent-text rounded"
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
                  onChange={(e) => updateAiConfig({ baseUrl: e.target.value })}
                  placeholder="https://api.openai.com/v1"
                  className="w-full px-3 py-1.5 bg-base border border-surface1 text-xs text-text font-mono placeholder:text-subtext0 focus:outline-none focus:border-surface2 rounded"
                />
              </div>

              <div className="flex items-center justify-between gap-6 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-text select-none">
                  <input
                    type="checkbox"
                    checked={aiConfig.streamResponse}
                    onChange={(e) => updateAiConfig({ streamResponse: e.target.checked })}
                    className="w-4 h-4 accent-text cursor-pointer rounded"
                  />
                  <span>Stream responses in real-time</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-text select-none">
                  <input
                    type="checkbox"
                    checked={aiConfig.enableCodeReviewAssist}
                    onChange={(e) => updateAiConfig({ enableCodeReviewAssist: e.target.checked })}
                    className="w-4 h-4 accent-text cursor-pointer rounded"
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
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-surface1 hover:bg-surface2 text-text text-xs font-semibold rounded transition-colors cursor-pointer border border-surface2 shadow-xs"
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
                  className="flex items-center gap-1 px-3 py-1.5 text-xs text-subtext0 hover:text-text hover:bg-surface1/40 rounded transition-colors cursor-pointer"
                  title="Reset provider settings to defaults"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              </div>

              {/* Inline Test Result */}
              {aiTestResult && (
                <div
                  className={`flex items-center gap-2 px-2.5 py-1 rounded text-xs animate-in fade-in ${
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
          {/* Header Action Bar */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-text block">
                Model Context Protocol (MCP) Ecosystem
              </span>
              <span className="text-[11px] text-subtext0 block">
                Connect external developer tools, file systems, Git context, and APIs directly to your AI
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setJsonTab('export');
                  setJsonFeedback(null);
                  setIsJsonModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surface1 hover:bg-surface1 text-subtext0 hover:text-text text-xs transition-colors cursor-pointer"
                title="Import or Export JSON configuration"
              >
                <FileJson className="w-3.5 h-3.5" />
                <span>Config JSON</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenAddServer()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-surface1 hover:bg-surface2 text-text text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-xs border border-surface2"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add MCP Server</span>
              </button>
            </div>
          </div>

          {/* Quick Preset Templates Bar */}
          <div className="p-2.5 bg-surface0/20 border border-surface0/80 flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold text-subtext0 uppercase tracking-wider">
              Quick Add Presets:
            </span>
            {MCP_PRESET_TEMPLATES.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => handleOpenAddServer(preset)}
                className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium bg-surface0 border border-surface1 hover:bg-surface1 text-text transition-colors cursor-pointer"
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
                  className="p-1 text-subtext0 hover:text-text rounded cursor-pointer"
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
                /* SSE URL */
                <div>
                  <label className="block text-[11px] font-medium text-subtext0 mb-1">
                    SSE Endpoint URL <span className="text-red">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <Globe className="w-3.5 h-3.5 text-subtext0 absolute left-2.5" />
                    <input
                      type="url"
                      value={serverUrl}
                      onChange={(e) => setServerUrl(e.target.value)}
                      placeholder="http://localhost:8000/sse"
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
                    className="flex items-center gap-1 text-[10px] text-subtext0 hover:text-text px-2 py-0.5 rounded hover:bg-surface1 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Variable</span>
                  </button>
                </div>

                <p className="text-[10px] text-subtext0 mb-2">
                  Server URLs and values are saved in local app preferences and included in configuration exports; do not embed credentials or enter passwords, API keys, or other secrets here.
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
                          type="text"
                          value={pair.value}
                          onChange={(e) => {
                            const copy = [...serverEnvPairs];
                            copy[idx].value = e.target.value;
                            setServerEnvPairs(copy);
                          }}
                          placeholder="value"
                          className="flex-1 px-2.5 py-1 bg-base border border-surface1 text-xs text-text font-mono placeholder:text-subtext0 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setServerEnvPairs(serverEnvPairs.filter((_, i) => i !== idx));
                          }}
                          className="p-1 text-subtext0 hover:text-red rounded cursor-pointer"
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
                  className="px-3 py-1.5 rounded-lg border border-surface1 hover:bg-surface1 text-subtext0 hover:text-text text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-brand hover:bg-brand/90 text-on-accent text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-md shadow-brand/20 border border-brand flex items-center gap-1.5"
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
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-surface1 hover:bg-surface2 text-text text-xs font-semibold rounded-lg transition-colors cursor-pointer border border-surface2 shadow-xs mt-1"
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
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-8 h-8 border flex items-center justify-center text-text shadow-xs ${
                            server.enabled
                              ? 'bg-surface1 border-surface2'
                              : 'bg-surface0 border-surface0 text-subtext0'
                          }`}
                        >
                          <Cable className="w-4 h-4 text-subtext0" />
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-text">{server.name}</span>
                            <span className="text-[10px] px-2 py-0.2 bg-surface1 text-subtext0 border border-surface2 font-mono uppercase">
                              {server.type}
                            </span>

                            {envCount > 0 && (
                              <span className="text-[10px] px-1.5 py-0.2 bg-surface0 text-subtext1 border border-surface1 font-mono">
                                {envCount} env var{envCount > 1 ? 's' : ''}
                              </span>
                            )}

                            {server.testStatus === 'success' && (
                              <span className="text-[10px] px-1.5 py-0.2 bg-surface1 text-text border border-surface2 font-mono flex items-center gap-1">
                                <Check className="w-3 h-3 text-text" />
                                <span>Verified</span>
                              </span>
                            )}
                          </div>

                          {server.description && (
                            <p className="text-[11px] text-subtext0 mt-0.5 line-clamp-1">
                              {server.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Server Controls */}
                      <div className="flex items-center gap-1.5">
                        {/* Enable/Disable Toggle */}
                        <button
                          type="button"
                          onClick={() => toggleMcpServer(server.id)}
                          className={`px-2 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                            server.enabled
                              ? 'bg-surface1 border-surface2 text-text shadow-xs'
                              : 'bg-surface0/50 border-surface0 text-subtext0 hover:text-text'
                          }`}
                          title={server.enabled ? 'Click to disable' : 'Click to enable'}
                        >
                          {server.enabled ? 'Enabled' : 'Disabled'}
                        </button>

                        {/* Ping / Test Handshake */}
                        <button
                          type="button"
                          onClick={() => handleTestServer(server.id)}
                          disabled={testingServerId === server.id}
                          className="p-1.5 rounded-lg border border-surface1 hover:bg-surface1 text-subtext0 hover:text-text transition-colors cursor-pointer"
                          title="Test MCP Server Handshake"
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
                          className="p-1.5 rounded-lg border border-surface1 hover:bg-surface1 text-subtext0 hover:text-text transition-colors cursor-pointer"
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
                              className="px-2 py-0.5 bg-red/20 hover:bg-red/30 text-red text-[11px] font-medium rounded transition-colors cursor-pointer"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingServerId(null)}
                              className="px-1.5 py-0.5 text-subtext0 hover:text-text text-[11px] rounded transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDeletingServerId(server.id)}
                            className="p-1.5 rounded-lg border border-surface1 hover:bg-red/10 text-subtext0 hover:text-red transition-colors cursor-pointer"
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

      {/* SUB-TAB 3: REVIEWER PERSONA & PROMPTS */}
      {activeSubTab === 'prompts' && (
        <div className="space-y-4 animate-in fade-in duration-100">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-text">
                System Instructions & Code Review Persona
              </label>
              <button
                type="button"
                onClick={() => updateAiConfig({ systemPrompt: DEFAULT_AI_CONFIG.systemPrompt })}
                className="text-[10px] text-subtext0 hover:text-text underline cursor-pointer"
              >
                Reset to Default Persona
              </button>
            </div>
            <p className="text-[11px] text-subtext0 mb-2">
              Guide how the AI agent critiques code diffs, detects bugs, and suggests refactoring
            </p>

            <textarea
              rows={8}
              value={aiConfig.systemPrompt}
              onChange={(e) => updateAiConfig({ systemPrompt: e.target.value })}
              className="w-full p-3 bg-base border border-surface1 text-xs text-text font-mono leading-relaxed placeholder:text-subtext0 focus:outline-none focus:border-surface2 select-text"
              placeholder="Enter instructions for the AI reviewer..."
            />
          </div>

          {/* Persona Presets */}
          <div>
            <span className="block text-xs font-semibold text-text mb-2">
              One-Click Persona Presets:
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() =>
                  updateAiConfig({
                    systemPrompt: `You are an expert Security Engineer and Auditor.
Analyze code changes for:
- Injection risks (SQL, Command, XSS)
- Authentication/Authorization vulnerabilities
- Unsafe memory operations or concurrent race conditions
- Data leaks, secrets exposure, and untrusted input parsing
Provide clear CVSS impact assessment and secure remediations.`,
                  })
                }
                className="p-3 bg-surface0/30 hover:bg-surface0 border border-surface0 hover:border-surface1 text-left rounded-xl transition-all cursor-pointer group"
              >
                <div className="text-xs font-bold text-text group-hover:text-brand">
                  🔒 Security & Vulnerability Auditor
                </div>
                <div className="text-[10px] text-subtext0 mt-1">
                  Focus on OWASP Top 10, concurrency races, input sanitization, and leak prevention
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  updateAiConfig({
                    systemPrompt: `You are a Principal Software Architect.
Review git diffs for:
- High-level design patterns and SOLID principles
- Maintainability, decoupling, and API contract purity
- Performance bottlenecks and algorithmic complexity
- Testability and clear error handling hierarchies`,
                  })
                }
                className="p-3 bg-surface0/30 hover:bg-surface0 border border-surface0 hover:border-surface1 text-left rounded-xl transition-all cursor-pointer group"
              >
                <div className="text-xs font-bold text-text group-hover:text-brand">
                  🏛️ Senior Software Architect
                </div>
                <div className="text-[10px] text-subtext0 mt-1">
                  Focus on architectural cohesion, API design, scalability, and clean code
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  updateAiConfig({
                    systemPrompt: `You are a Concise Pull Request Reviewer.
Produce rapid, punchy reviews:
- 1-sentence summary of the commit/PR intent
- Bullet points of breaking changes or hazards
- Immediate suggestions (line-by-line diff replacements)
Keep response under 200 words.`,
                  })
                }
                className="p-3 bg-surface0/30 hover:bg-surface0 border border-surface0 hover:border-surface1 text-left rounded-xl transition-all cursor-pointer group"
              >
                <div className="text-xs font-bold text-text group-hover:text-brand">
                  ⚡ Concise PR Summarizer
                </div>
                <div className="text-[10px] text-subtext0 mt-1">
                  Short, bulleted summaries emphasizing breaking changes and risks
                </div>
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
                className="p-1 text-subtext0 hover:text-text rounded cursor-pointer"
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
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-surface1 hover:bg-surface2 text-text text-xs font-semibold rounded-lg transition-colors cursor-pointer border border-surface2 shadow-xs"
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
                    className="px-3 py-1.5 rounded-lg border border-surface1 hover:bg-surface1 text-subtext0 hover:text-text text-xs transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleImportJson}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-surface1 hover:bg-surface2 text-text text-xs font-semibold rounded-lg transition-colors cursor-pointer border border-surface2 shadow-xs"
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
