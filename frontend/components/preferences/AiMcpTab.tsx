import React, { useState, useEffect } from 'react';
import {
  Cable,
  Plus,
  Trash2,
  Check,
  ChevronLeft,
  Copy,
  RefreshCw,
  AlertCircle,
  Eye,
  EyeOff,
  ExternalLink,
  FileJson,
  Terminal,
  Globe,
  RotateCcw,
  CheckCircle2,
  X,
  ShieldCheck,
  Edit3,
} from '@/components/common/icons';
import { useAiMcpStore } from '../../store/useAiMcpStore';
import {
  AI_PROVIDERS,
  MCP_PRESET_TEMPLATES,
  DEFAULT_AI_CONFIG,
} from '../../constants/aiPresets';
import {
  AiConfig,
  McpServerConfig,
  McpServerType,
} from '../../types/ai';

interface AiMcpTabProps {
  draftAiConfig?: AiConfig;
  onUpdateAiConfig?: (partial: Partial<AiConfig>) => void;
  onNavigateToGuardrails?: () => void;
  activeView?: 'providers' | 'mcp' | 'prompts';
  onBackToOverview?: () => void;
}

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
        : providerId === 'anthropic' && cliStatus.claude?.available
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
    void detectCli('claude');
  }, [checkCopilotStatus, checkGoogleAuthStatus, detectCli]);

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

  return (
    <div className="space-y-5">
      {onBackToOverview && (
        <button
          type="button"
          onClick={onBackToOverview}
          className="inline-flex items-center gap-1.5 text-xs text-subtext0 hover:text-text transition-colors cursor-pointer group"
        >
          <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to AI overview</span>
        </button>
      )}

      {/* Top Header & Sub-Navigation */}
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

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-subtext0 font-mono px-2 py-0.5 bg-surface0 border border-surface1">
              Active: {activeProviderPreset.name} • {aiConfig.model}
            </span>
          </div>
        </div>

        {/* Sub-Tab Navigation Bar */}
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

      {/* SUB-TAB 1: AI MODEL, ENGINE & SECURITY POLICIES */}
      {(activeSubTab === 'ai' || activeSubTab === 'guardrails') && (
        <div className="space-y-5 animate-in fade-in duration-100">
          {/* Provider Selection Grid */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-text">
                Select AI Engine / Provider
              </label>
              <span className="text-[10px] text-subtext0">
                Supports Cloud Subscriptions (Copilot, Claude, Gemini) & API Keys
              </span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {AI_PROVIDERS.map((p) => {
                const isSelected = aiConfig.provider === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setProvider(p.id)}
                    className={`flex flex-col items-center text-center p-3 rounded-xl border transition-all cursor-pointer relative ${
                      isSelected
                        ? 'bg-surface1 border-surface2 text-text shadow-xs ring-1 ring-surface2 font-semibold'
                        : 'bg-surface0/40 border-surface0/80 text-subtext0 hover:bg-surface0 hover:text-text'
                    }`}
                  >
                    {isSelected && (
                      <span className="absolute top-2 right-2">
                        <Check className="w-3 h-3 text-text" />
                      </span>
                    )}
                    <span className="text-xs font-bold text-text mb-0.5">{p.name}</span>
                    <span className="text-[10px] text-subtext0 line-clamp-2 leading-tight">
                      {p.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Provider Settings Container */}
          <div className="p-4 bg-surface0/30 border border-surface0 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-surface0/80">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-text">
                  {activeProviderPreset.name} Configuration
                </span>
                <span className="text-[10px] px-2 py-0.5 bg-surface1 text-subtext0 border border-surface2 font-mono">
                  {aiConfig.provider === 'ollama'
                    ? 'Offline Local Daemon'
                    : aiConfig.authMode === 'cli_bridge'
                    ? 'CLI Subprocess Bridge'
                    : aiConfig.authMode === 'subscription_oauth' || aiConfig.provider === 'github_copilot'
                    ? 'Cloud Subscription'
                    : 'Direct API Key'}
                </span>
              </div>

              {activeProviderPreset.docUrl && (
                <a
                  href={activeProviderPreset.docUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-[11px] text-subtext0 hover:text-text underline cursor-pointer"
                >
                  <span>Documentation</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            {/* Auth Method Toggle (when provider supports both Cloud Subscription/CLI and API Key) */}
            {activeProviderPreset.supportedAuthModes && activeProviderPreset.supportedAuthModes.length > 1 && (
              <div className="p-3 bg-base/60 border border-surface1 rounded-lg space-y-2">
                <div className="text-[11px] font-semibold text-text flex items-center justify-between">
                  <span>Connection Option</span>
                  <span className="text-[10px] text-subtext0">
                    {aiConfig.authMode === 'subscription_oauth' || aiConfig.authMode === 'cli_bridge'
                      ? '✓ Included in your monthly subscription (No per-token bills)'
                      : 'Pay-per-token API billing'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const mode = activeProviderPreset.supportedAuthModes?.includes('subscription_oauth')
                        ? 'subscription_oauth'
                        : 'cli_bridge';
                      updateAiConfig({ authMode: mode });
                    }}
                    className={`px-3 py-2 rounded-lg border text-left text-xs transition-all cursor-pointer flex items-center gap-2.5 ${
                      aiConfig.authMode === 'subscription_oauth' || aiConfig.authMode === 'cli_bridge'
                        ? 'bg-surface1 border-surface2 text-text font-semibold shadow-xs ring-1 ring-surface2'
                        : 'bg-surface0/50 border-surface0 text-subtext0 hover:bg-surface0 hover:text-text'
                    }`}
                  >
                    <div className="p-1.5 rounded-md bg-accent/15 text-accent shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-bold text-text">Cloud Subscription</div>
                      <div className="text-[10px] text-subtext0">
                        {aiConfig.provider === 'github_copilot'
                          ? 'GitHub Copilot Device Flow'
                          : aiConfig.provider === 'anthropic'
                          ? 'Claude Code CLI (claude)'
                          : 'Google AI Pro (OAuth/ADC)'}
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => updateAiConfig({ authMode: 'api_key' })}
                    className={`px-3 py-2 rounded-lg border text-left text-xs transition-all cursor-pointer flex items-center gap-2.5 ${
                      aiConfig.authMode === 'api_key' || !aiConfig.authMode
                        ? 'bg-surface1 border-surface2 text-text font-semibold shadow-xs ring-1 ring-surface2'
                        : 'bg-surface0/50 border-surface0 text-subtext0 hover:bg-surface0 hover:text-text'
                    }`}
                  >
                    <div className="p-1.5 rounded-md bg-surface2/60 text-subtext0 shrink-0">
                      <Terminal className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-bold text-text">Developer API Key</div>
                      <div className="text-[10px] text-subtext0">Standard pay-per-token API key</div>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Model Name and Quick Pickers */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-text">Model Identifier</label>
                <span className="text-[10px] text-subtext0">
                  Select recommended or type any custom model ID
                </span>
              </div>

              <div className="space-y-2">
                <input
                  type="text"
                  value={aiConfig.model}
                  onChange={(e) => updateAiConfig({ model: e.target.value })}
                  placeholder="e.g. claude-3-7-sonnet-20250219, gpt-4o, deepseek-r1:latest"
                  className="w-full px-3 py-1.5 bg-base border border-surface1 text-xs text-text font-mono placeholder:text-subtext0 focus:outline-none focus:border-surface2"
                />

                {/* Model Recommendation Chips */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] text-subtext0 font-medium">Quick Pick:</span>
                  {activeProviderPreset.models.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => updateAiConfig({ model: m.id })}
                      className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-all cursor-pointer ${
                        aiConfig.model === m.id
                          ? 'bg-surface2 border-surface2 text-text font-bold shadow-xs'
                          : 'bg-surface0 border-surface1 text-subtext0 hover:bg-surface1 hover:text-text'
                      }`}
                      title={m.recommendedFor ? `Recommended for: ${m.recommendedFor}` : undefined}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* AUTH SECTION: Cloud Subscription, CLI Bridge, or API Key */}
            {aiConfig.provider === 'github_copilot' ? (
              /* Phase 2: GitHub Copilot Device Authorization Panel */
              <div className="p-3.5 bg-surface0/60 border border-surface1 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">🐙</span>
                    <span className="text-xs font-bold text-text">GitHub Copilot Subscription (Device Flow)</span>
                  </div>
                  {copilotStatus?.connected && (
                    <button
                      type="button"
                      onClick={() => disconnectCopilot()}
                      className="px-2.5 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-[11px] text-red-400 border border-red-500/30 transition-colors cursor-pointer"
                    >
                      Sign Out
                    </button>
                  )}
                </div>

                {copilotStatus?.connected ? (
                  <div className="p-3 bg-base border border-surface0 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        {copilotStatus.avatar_url ? (
                          <img
                            src={copilotStatus.avatar_url}
                            alt="GitHub avatar"
                            className="w-7 h-7 rounded-full border border-surface2"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-surface2 flex items-center justify-center font-bold text-xs text-text">
                            GH
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-xs text-text">
                            {copilotStatus.username || 'GitHub User'}
                          </div>
                          <div className="text-[10px] text-green-400 flex items-center gap-1 font-medium">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Copilot Subscription Active (Included in your GitHub plan)</span>
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-surface1 text-subtext0 border border-surface2 font-mono">
                        {aiConfig.model}
                      </span>
                    </div>
                  </div>
                ) : copilotDeviceCode ? (
                  <div className="p-3.5 bg-base border border-accent/40 rounded-lg space-y-3 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-text">GitHub Device Verification Required</div>
                      <button
                        type="button"
                        onClick={() => clearCopilotDeviceCode()}
                        className="text-subtext0 hover:text-text cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-[11px] text-subtext0">
                      Enter this code at GitHub to authorize your Copilot subscription:
                    </p>
                    <div className="flex items-center justify-between p-2.5 bg-surface0 border border-surface2 rounded">
                      <span className="text-lg font-mono font-bold tracking-widest text-accent">
                        {copilotDeviceCode.user_code}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard.writeText(copilotDeviceCode.user_code);
                          window.open(copilotDeviceCode.verification_uri, '_blank');
                        }}
                        className="px-3 py-1.5 rounded bg-accent hover:bg-accent/90 text-surface0 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Code & Open GitHub</span>
                      </button>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-subtext0 font-mono">
                      <RefreshCw className="w-3 h-3 animate-spin text-accent" />
                      <span>Waiting for approval on github.com/login/device...</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => startCopilotFlow()}
                      disabled={isConnectingSubscription}
                      className="w-full py-2 px-3 rounded-lg bg-accent/20 hover:bg-accent/30 border border-accent/50 text-accent font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-xs"
                    >
                      {isConnectingSubscription ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      <span>Sign In with GitHub Copilot (Device Flow)</span>
                    </button>
                    <p className="text-[10px] text-subtext0 text-center">
                      Uses your existing GitHub Copilot $10/mo or Business subscription. No API keys or extra token bills.
                    </p>
                  </div>
                )}
              </div>
            ) : aiConfig.provider === 'anthropic' && aiConfig.authMode === 'cli_bridge' ? (
              /* Phase 1: Claude Code CLI Bridge Panel */
              <div className="p-3.5 bg-surface0/60 border border-surface1 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-accent" />
                    <span className="text-xs font-bold text-text">Claude Code CLI Subprocess Bridge</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => detectCli('claude')}
                    disabled={isDetectingCli}
                    className="px-2.5 py-1 rounded bg-surface1 hover:bg-surface2 text-[11px] text-text border border-surface2 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${isDetectingCli ? 'animate-spin' : ''}`} />
                    <span>Scan CLI</span>
                  </button>
                </div>

                {cliStatus.claude?.available ? (
                  <div className="space-y-2 text-xs">
                    <div className="p-2.5 bg-base border border-surface0 rounded flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="font-mono text-text">
                          {cliStatus.claude.version || 'Claude CLI Detected'}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface1 text-subtext0 border border-surface2 font-mono">
                          {cliStatus.claude.logged_in ? 'Subscription Authenticated' : 'Session Ready'}
                        </span>
                      </div>
                      {cliStatus.claude.executable_path && (
                        <span
                          className="text-[10px] text-subtext0 font-mono truncate max-w-[200px]"
                          title={cliStatus.claude.executable_path}
                        >
                          {cliStatus.claude.executable_path}
                        </span>
                      )}
                    </div>

                    {cliStatus.claude.auth_info && (
                      <p className="text-[11px] text-subtext0">
                        {cliStatus.claude.auth_info}
                      </p>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={async () => {
                          setTestingCliType('claude');
                          const res = await executeCliTest('claude');
                          setCliTestOutput((prev) => ({ ...prev, claude: res.output }));
                          setTestingCliType(null);
                        }}
                        disabled={testingCliType === 'claude'}
                        className="px-3 py-1.5 bg-accent/20 hover:bg-accent/30 text-accent border border-accent/40 rounded text-xs font-medium cursor-pointer transition-colors flex items-center gap-1.5"
                      >
                        {testingCliType === 'claude' && <RefreshCw className="w-3 h-3 animate-spin" />}
                        <span>Test Review Prompt via Claude CLI</span>
                      </button>
                    </div>

                    {cliTestOutput.claude && (
                      <div className="mt-2 p-2.5 bg-base border border-surface1 rounded font-mono text-[11px] text-subtext1 max-h-36 overflow-y-auto whitespace-pre-wrap">
                        {cliTestOutput.claude}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 bg-base border border-surface1 rounded-lg space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-yellow-400">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span className="font-semibold">Claude Code CLI not found in PATH</span>
                    </div>
                    <p className="text-subtext0 text-[11px]">
                      Install Claude Code CLI globally, then run{' '}
                      <code className="px-1.5 py-0.5 bg-surface1 text-text rounded font-mono text-[10px]">
                        claude login
                      </code>{' '}
                      to link your Claude Pro/Team subscription:
                    </p>
                    <div className="flex items-center justify-between p-2 bg-surface0 border border-surface1 rounded font-mono text-[11px] text-text">
                      <span>npm install -g @anthropic-ai/claude-code</span>
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard.writeText('npm install -g @anthropic-ai/claude-code');
                          setCopiedCode(true);
                          setTimeout(() => setCopiedCode(false), 2000);
                        }}
                        className="text-subtext0 hover:text-text cursor-pointer"
                        title="Copy command"
                      >
                        {copiedCode ? (
                          <Check className="w-3.5 h-3.5 text-green-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : aiConfig.provider === 'gemini' && aiConfig.authMode === 'subscription_oauth' ? (
              /* Phase 3: Google AI Pro / Gemini Advanced OAuth Panel */
              <div className="p-3.5 bg-surface0/60 border border-surface1 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">✨</span>
                    <span className="text-xs font-bold text-text">Google AI Pro (OAuth 2.0 PKCE / ADC)</span>
                  </div>
                  {googleAuthStatus?.connected && (
                    <button
                      type="button"
                      onClick={() => disconnectGoogleOAuth()}
                      className="px-2.5 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-[11px] text-red-400 border border-red-500/30 transition-colors cursor-pointer"
                    >
                      Sign Out
                    </button>
                  )}
                </div>

                {googleAuthStatus?.connected ? (
                  <div className="p-3 bg-base border border-surface0 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-xs text-text">
                          {googleAuthStatus.account_email || 'Google Account Connected'}
                        </div>
                        <div className="text-[10px] text-green-400 flex items-center gap-1 font-medium">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>
                            {googleAuthStatus.auth_method === 'gcloud_adc'
                              ? 'Connected via Application Default Credentials (gcloud ADC)'
                              : 'Google One AI Premium / Gemini Advanced Active'}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-surface1 text-subtext0 border border-surface2 font-mono">
                        {aiConfig.model}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => startGoogleOAuth()}
                      disabled={isConnectingSubscription}
                      className="w-full py-2 px-3 rounded-lg bg-accent/20 hover:bg-accent/30 border border-accent/50 text-accent font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-xs"
                    >
                      {isConnectingSubscription ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      <span>Sign In with Google Account (Gemini Advanced)</span>
                    </button>
                    <p className="text-[10px] text-subtext0 text-center">
                      Opens your browser to verify Google One AI Premium subscription via secure local loopback OAuth. Also auto-detects `gcloud auth application-default login`.
                    </p>
                  </div>
                )}
              </div>
            ) : activeProviderPreset.requiresApiKey ? (
              /* Standard API Key field */
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-text">
                    API Secret Key <span className="text-red">*</span>
                  </label>
                  <span className="text-[10px] text-subtext0/70 font-mono">
                    {hasSavedApiKey ? 'Saved in the OS credential store' : 'Stored only in the OS credential store'}
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
                        : 'sk-..., gsk_..., or your API token'
                    }
                    className="w-full px-3 pr-10 py-1.5 bg-base border border-surface1 text-xs text-text font-mono placeholder:text-subtext0 focus:outline-none focus:border-surface2"
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
              <div className="p-2.5 bg-base/60 border border-surface0 flex items-center gap-2 text-xs text-subtext0">
                <ShieldCheck className="w-4 h-4 text-subtext0 shrink-0" />
                <span>
                  Ollama runs offline on your local machine. No API key is required. Ensure the Ollama
                  service is started (`ollama serve`).
                </span>
              </div>
            )}

            {/* Endpoint / Base URL */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-text">API Base URL / Endpoint</label>
                {aiConfig.baseUrl !== activeProviderPreset.defaultBaseUrl && (
                  <button
                    type="button"
                    onClick={() => updateAiConfig({ baseUrl: activeProviderPreset.defaultBaseUrl })}
                    className="text-[10px] text-subtext0 hover:text-text underline cursor-pointer"
                  >
                    Reset to default ({activeProviderPreset.defaultBaseUrl})
                  </button>
                )}
              </div>
              <input
                type="text"
                value={aiConfig.baseUrl}
                onChange={(e) => updateAiConfig({ baseUrl: e.target.value })}
                placeholder="https://api.openai.com/v1"
                className="w-full px-3 py-1.5 bg-base border border-surface1 text-xs text-text font-mono placeholder:text-subtext0 focus:outline-none focus:border-surface2"
              />
              <p className="text-[10px] text-subtext0 mt-1">
                Do not embed credentials in this URL. Cloud connection tests are simulated and do not contact this endpoint.
              </p>
            </div>

            {/* Hyperparameters: Temperature & Max Tokens */}
            <div className="grid grid-cols-2 gap-4 pt-1">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-text">
                    Temperature: <span className="font-mono text-text">{aiConfig.temperature}</span>
                  </label>
                  <span className="text-[10px] text-subtext0 font-mono">
                    {aiConfig.temperature <= 0.2 ? 'Deterministic (Code Review)' : 'Balanced'}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={aiConfig.temperature}
                  onChange={(e) => updateAiConfig({ temperature: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-surface1 appearance-none cursor-pointer accent-text"
                />
                <div className="flex justify-between text-[10px] text-subtext0 mt-1 font-mono">
                  <span>0.0 (Strict)</span>
                  <span>0.5</span>
                  <span>1.0 (Creative)</span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-text">Max Output Tokens</label>
                  <span className="text-[10px] text-subtext0 font-mono">{aiConfig.maxTokens} tokens</span>
                </div>
                <select
                  value={aiConfig.maxTokens}
                  onChange={(e) => updateAiConfig({ maxTokens: parseInt(e.target.value, 10) })}
                  className="w-full px-3 py-1.5 bg-base border border-surface1 text-xs text-text focus:outline-none focus:border-surface2 cursor-pointer font-mono"
                >
                  <option value="1024">1,024 Tokens (Compact)</option>
                  <option value="2048">2,048 Tokens (Standard)</option>
                  <option value="4096">4,096 Tokens (Recommended for Diffs)</option>
                  <option value="8192">8,192 Tokens (Large MR Review)</option>
                  <option value="16384">16,384 Tokens (Deep Reasoning / Extended)</option>
                </select>
              </div>
            </div>

            {/* Options Toggles */}
            <div className="space-y-2 pt-2 border-t border-surface0/80">
              <label className="flex items-center justify-between cursor-pointer py-1">
                <div>
                  <span className="text-xs font-semibold text-text block">
                    Stream AI Generation in Real-Time
                  </span>
                  <span className="text-[10px] text-subtext0 block">
                    Render code review feedback tokens incrementally as they are generated
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={aiConfig.streamResponse}
                  onChange={(e) => updateAiConfig({ streamResponse: e.target.checked })}
                  className="w-4 h-4 accent-text cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer py-1">
                <div>
                  <span className="text-xs font-semibold text-text block">
                    Enable Automated Diff Summarization
                  </span>
                  <span className="text-[10px] text-subtext0 block">
                    Automatically generate AI explanations when selecting Git commits or changed files
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={aiConfig.enableCodeReviewAssist}
                  onChange={(e) => updateAiConfig({ enableCodeReviewAssist: e.target.checked })}
                  className="w-4 h-4 accent-text cursor-pointer"
                />
              </label>
            </div>

            {/* Test Connection Result Status */}
            {aiTestResult && (
              <div
                className={`p-3 border flex items-start justify-between text-xs animate-in fade-in duration-100 ${
                  aiTestResult.success
                    ? 'bg-surface1 border-surface2 text-text'
                    : 'bg-surface1 border-surface2 text-subtext0'
                }`}
              >
                <div className="flex items-start gap-2">
                  {aiTestResult.success ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  )}
                  <span className="leading-relaxed">{aiTestResult.message}</span>
                </div>
                <button
                  type="button"
                  onClick={clearAiTestResult}
                  className="p-1 hover:bg-surface1/20 rounded cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Test Connection Action Button */}
            <div className="flex items-center justify-between pt-2 border-t border-surface0/80">
              <button
                type="button"
                onClick={resetAiConfig}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surface1 hover:bg-surface1 text-subtext0 hover:text-text text-xs transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Defaults</span>
              </button>

              <button
                type="button"
                onClick={() => void testAiConnection(aiConfig, hasSavedApiKey || !!apiKeyDraft.trim())}
                disabled={isTestingAi}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-surface1 hover:bg-surface2 text-text text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-xs border border-surface2"
              >
                {isTestingAi ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Testing Connection...</span>
                  </>
                ) : (
                  <span>Test AI Connection</span>
                )}
              </button>
            </div>
          </div>

          {/* AI Security Guardrails Link Notice */}
          <div className="pt-2">
            <div className="p-3.5 bg-surface0/30 border border-surface0/60 rounded flex items-center justify-between gap-4">
              <div>
                <span className="text-xs font-semibold text-text block">
                  AI Security Guardrails &amp; Tool Execution Policies
                </span>
                <span className="text-[11px] text-subtext0 block mt-0.5">
                  Command whitelist, security isolation policies, simulator, and audit logs are available in the dedicated Security Guardrails tab.
                </span>
              </div>
              {onNavigateToGuardrails && (
                <button
                  type="button"
                  onClick={onNavigateToGuardrails}
                  className="px-3 py-1.5 bg-surface1 hover:bg-surface2 text-text text-xs rounded border border-surface2 transition-colors cursor-pointer shrink-0 font-medium"
                >
                  Open Guardrails
                </button>
              )}
            </div>
          </div>
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
                  <select
                    value={serverType}
                    onChange={(e) => setServerType(e.target.value as McpServerType)}
                    className="w-full px-3 py-1.5 bg-base border border-surface1 text-xs text-text focus:outline-none focus:border-surface2 cursor-pointer"
                  >
                    <option value="stdio">stdio (Command / Subprocess)</option>
                    <option value="sse">sse (HTTP Server-Sent Events)</option>
                  </select>
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
                  className="px-4 py-1.5 bg-brand hover:bg-brand/90 text-[#11111b] text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-md shadow-brand/20 border border-brand flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5 text-[#11111b]" />
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
        <div className="fixed inset-x-0 bottom-0 top-8.5 z-60 bg-crust/80 backdrop-blur-xs flex items-center justify-center p-4">
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
