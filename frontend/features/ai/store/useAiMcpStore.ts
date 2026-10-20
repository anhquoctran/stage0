import { create } from 'zustand';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { type AiConfig } from '../types/AiConfig';
import { activeProviderSettings, configuredProviderIds, providerSettingsFor, rememberActiveProviderSettings } from '../utils/aiProviderSettings';
import { type AiModelPreset } from '../types/AiModelPreset';
import { type McpServerConfig } from '../types/McpServerConfig';
import { type McpConfigFileFormat } from '../types/McpConfigFileFormat';
import { type GuardrailPolicy } from '../types/GuardrailPolicy';
import { type GuardrailAuditEvent } from '../types/GuardrailAuditEvent';
import { type GuardrailEvaluationResult } from '../types/GuardrailEvaluationResult';
import { DEFAULT_GUARDRAIL_POLICY } from '../types/guardrails';
import { DEFAULT_AI_CONFIG, DEFAULT_MCP_SERVERS, AI_PROVIDERS } from '../constants/aiPresets';
import type { AiMcpState } from '../types/AiMcpState';
import { MCP_TRANSPORT_UNAVAILABLE } from '../constants/runtimeAvailability';
import { resetMcpVerification } from '../utils/resetMcpVerification';
import { preferencesJsonService } from '../../preferences/services/preferencesJsonService';
import { listSecretMcpEnv, publicMcpEnv } from '../utils/listSecretMcpEnv';
import type { AcpAgentConfig } from '../types/AcpAgentConfig';

const STORAGE_KEY = 'stage0_ai_mcp_config';
const LEGACY_DEFAULT_AI_SYSTEM_PROMPT = `You are an expert software engineer and code reviewer embedded in Stage0 Git Reviewer.
When reviewing git diffs:
1. Identify logic flaws, subtle edge cases, concurrency hazards, and security issues.
2. Recommend idiomatic, performant patterns conforming to the language standard.
3. Be clear, constructive, and concise. Avoid superfluous praise.
4. Format markdown with code blocks, line references, and actionable improvements.`;

function normalizeLoadedAiConfig(saved?: Partial<AiConfig>): AiConfig {
  const loaded: AiConfig = { ...DEFAULT_AI_CONFIG, ...(saved || {}), apiKey: '' };
  if (!AI_PROVIDERS.some((provider) => provider.id === loaded.provider)) {
    loaded.provider = DEFAULT_AI_CONFIG.provider;
    loaded.model = DEFAULT_AI_CONFIG.model;
    loaded.baseUrl = DEFAULT_AI_CONFIG.baseUrl;
  }
  delete (loaded as AiConfig & { authMode?: unknown }).authMode;
  delete (loaded as AiConfig & { cliType?: unknown }).cliType;
  if (loaded.providerSettings) {
    delete (loaded.providerSettings as Record<string, unknown>).github_copilot;
    for (const settings of Object.values(loaded.providerSettings)) {
      if (settings) {
        delete (settings as typeof settings & { authMode?: unknown }).authMode;
        delete (settings as typeof settings & { cliType?: unknown }).cliType;
      }
    }
  }
  loaded.configuredProviders = Array.isArray(saved?.configuredProviders)
    ? configuredProviderIds(loaded)
    : saved && Object.keys(saved).length
      ? configuredProviderIds({ ...loaded, configuredProviders: undefined })
      : [];
  return loaded;
}
function loadPersistedState(): {
  aiConfig: AiConfig;
  mcpServers: McpServerConfig[];
  guardrailPolicy: GuardrailPolicy;
  externalAgents: AcpAgentConfig[];
} {
  if (typeof window === 'undefined') {
    return {
      aiConfig: DEFAULT_AI_CONFIG,
      mcpServers: DEFAULT_MCP_SERVERS,
      guardrailPolicy: DEFAULT_GUARDRAIL_POLICY,
      externalAgents: [],
    };
  }

  try {
    const bootstrap = window.__STAGE0_PREFERENCES__;
    // An empty AI section is still authoritative when native bootstrap has
    // loaded preferences.json. Falling back to localStorage here can resurrect
    // stale settings and create a second source of truth.
    const raw = bootstrap !== undefined
      ? JSON.stringify(bootstrap.ai ?? {})
      : localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const legacyKey = parsed.aiConfig?.apiKey;
      const savedAiConfig = { ...(parsed.aiConfig || {}) };
      // Reviewer system prompts are product-owned, not user preferences. Drop
      // the legacy editable field and retain a customized value as separate
      // supplemental instructions for global reviews.
      const legacySystemPrompt = savedAiConfig.systemPrompt;
      delete savedAiConfig.systemPrompt;
      if (typeof savedAiConfig.reviewerInstructions !== 'string' || !savedAiConfig.reviewerInstructions.trim()) {
        if (typeof legacySystemPrompt === 'string'
          && legacySystemPrompt.trim()
          && legacySystemPrompt !== LEGACY_DEFAULT_AI_SYSTEM_PROMPT) {
          savedAiConfig.reviewerInstructions = legacySystemPrompt;
        }
      }
      const loadedAiConfig = normalizeLoadedAiConfig(savedAiConfig);

      const loadedGuardrailPolicy: GuardrailPolicy = {
        ...DEFAULT_GUARDRAIL_POLICY,
        ...(parsed.guardrailPolicy || {}),
      };

      const loadedMcpServers = (Array.isArray(parsed.mcpServers)
        ? parsed.mcpServers
        : DEFAULT_MCP_SERVERS).map(resetMcpVerification);
      // Erase legacy plaintext before starting asynchronous keychain I/O. If
      // the OS keychain is unavailable, the user must re-enter the key rather
      // than silently leaving a plaintext credential behind.
      if (typeof legacyKey === 'string' && legacyKey.trim().length > 0) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({
            aiConfig: loadedAiConfig,
            mcpServers: loadedMcpServers,
            guardrailPolicy: loadedGuardrailPolicy,
            externalAgents: Array.isArray(parsed.externalAgents) ? parsed.externalAgents : [],
          }));
        } catch {
          localStorage.removeItem(STORAGE_KEY);
        }

        const legacyKeyProvider = typeof savedAiConfig.provider === 'string'
          && AI_PROVIDERS.some((provider) => provider.id === savedAiConfig.provider)
          ? savedAiConfig.provider as AiConfig['provider']
          : savedAiConfig.provider === undefined ? DEFAULT_AI_CONFIG.provider : null;
        if (isTauri() && legacyKeyProvider) {
          void invoke('store_ai_api_key', {
            provider: legacyKeyProvider,
            apiKey: legacyKey.trim(),
          }).catch(() => {
            console.warn('A previously saved API key could not be moved to the OS credential store. Please enter it again.');
          });
        } else {
          console.warn('A legacy plaintext API key was removed from browser storage. Please enter it again in the desktop app.');
        }
      }

      // Keep explicitly saved model choices. Preset defaults are for missing fields,
      // not a reason to silently replace a user's valid selection on each startup.
      const savedPreset = AI_PROVIDERS.find((provider) => provider.id === loadedAiConfig.provider);
      if (!parsed.aiConfig?.model) loadedAiConfig.model = savedPreset?.defaultModel || DEFAULT_AI_CONFIG.model;
      if (parsed.aiConfig?.baseUrl === undefined) loadedAiConfig.baseUrl = savedPreset?.defaultBaseUrl || DEFAULT_AI_CONFIG.baseUrl;

      return {
        aiConfig: loadedAiConfig,
        mcpServers: loadedMcpServers,
        guardrailPolicy: loadedGuardrailPolicy,
        externalAgents: Array.isArray(parsed.externalAgents) ? parsed.externalAgents.filter((agent: AcpAgentConfig) => agent && typeof agent.id === 'string' && typeof agent.name === 'string' && typeof agent.command === 'string' && Array.isArray(agent.args)) : [],
      };
    }
  } catch (err) {
    console.warn('Failed to load persisted AI & MCP settings:', err);
  }

  return {
    aiConfig: DEFAULT_AI_CONFIG,
    mcpServers: DEFAULT_MCP_SERVERS,
    guardrailPolicy: DEFAULT_GUARDRAIL_POLICY,
    externalAgents: [],
  };
}

function persistState(
  aiConfig: AiConfig,
  mcpServers: McpServerConfig[],
  guardrailPolicy?: GuardrailPolicy,
  externalAgents: AcpAgentConfig[] = []
) {
  if (typeof window === 'undefined') return;
  if (listSecretMcpEnv(mcpServers).length) {
    console.warn('MCP preferences were not saved because secret environment variables must be moved to the OS keychain first.');
    return;
  }
  const sanitizedAiConfig = { ...aiConfig } as Partial<AiConfig>;
  delete sanitizedAiConfig.apiKey;
  const persistedAiConfig = sanitizedAiConfig as Record<string, unknown>;
  persistedAiConfig.authMode = { $stage0Delete: true };
  persistedAiConfig.cliType = { $stage0Delete: true };
  const persistedServers = mcpServers.map((server) => {
    const clean = resetMcpVerification(server);
    const env = Object.fromEntries(Object.entries(clean.env ?? {}).filter(([key, value]) =>
      !/(token|secret|password|credential|api[_-]?key)/i.test(key) &&
      !/^(sk-|ghp_|github_pat_|glpat-|xox[bp]-)/i.test(value.trim())
    ));
    return { ...clean, env };
  });
  void preferencesJsonService.patch({
    ai: {
      aiConfig: persistedAiConfig,
      mcpServers: persistedServers,
      guardrailPolicy: guardrailPolicy || DEFAULT_GUARDRAIL_POLICY,
      externalAgents,
    },
  }).catch((error) => console.error('Could not save preferences.json:', error));
}

const initialState = loadPersistedState();

export const useAiMcpStore = create<AiMcpState>((set, get) => ({
  aiConfig: initialState.aiConfig,
  apiKeysConfigured: {},
  isCheckingApiKey: false,
  apiKeyCheckError: null,
  mcpServers: initialState.mcpServers,
  guardrailPolicy: initialState.guardrailPolicy,
  externalAgents: initialState.externalAgents,
  updateExternalAgents: (agents) => {
    set({ externalAgents: agents });
    persistState(get().aiConfig, get().mcpServers, get().guardrailPolicy, agents);
  },
  guardrailAuditLog: [],
  isGuardrailLoading: false,
  isTestingAi: false,
  aiTestResult: null,
  activeSubTab: 'ai',

  // Dynamic Live Models State
  dynamicModels: {},
  isFetchingDynamicModels: false,
  dynamicModelError: null,

  setActiveSubTab: (tab) => set({ activeSubTab: tab }),

  updateAiConfig: (partial) => {
    const { apiKey, ...safePartial } = partial;
    const nextConfig: AiConfig = {
      ...get().aiConfig,
      ...safePartial,
      apiKey: '',
    };
    if (['model', 'baseUrl', 'reasoningEffort', 'fastMode'].some((key) => key in safePartial)
      && configuredProviderIds(nextConfig).includes(nextConfig.provider)) {
      nextConfig.providerSettings = {
        ...nextConfig.providerSettings,
        [nextConfig.provider]: activeProviderSettings(nextConfig),
      };
    }
    const keyToSave = typeof apiKey === 'string' ? apiKey.trim() : '';
    set({ aiConfig: nextConfig, aiTestResult: null });
    persistState(nextConfig, get().mcpServers, get().guardrailPolicy, get().externalAgents);

    // Plaintext is sent only to the OS keyring and never retained in Zustand.
    if (keyToSave && isTauri()) {
      const provider = nextConfig.provider;
      void invoke('store_ai_api_key', {
        provider,
        apiKey: keyToSave,
      }).then(() => {
        set((state) => ({
          apiKeysConfigured: { ...state.apiKeysConfigured, [provider]: true },
        }));
      }).catch((err) => {
        console.error('Failed to store API key in OS Keyring:', err);
      });
    }
  },

  resetAiConfig: () => {
    const currentProvider = get().aiConfig.provider;
    set({
      aiConfig: DEFAULT_AI_CONFIG,
      aiTestResult: null,
      apiKeysConfigured: { ...get().apiKeysConfigured, [currentProvider]: false },
    });
    persistState(DEFAULT_AI_CONFIG, get().mcpServers, get().guardrailPolicy, get().externalAgents);
    if (isTauri()) {
      void invoke('delete_ai_api_key', { provider: currentProvider }).catch(() => {});
    }
  },

  loadApiKeyForProvider: async (providerId) => {
    // Explicit user action only. Status checks must not cascade into another
    // keyring read/model request, nor queue more prompts while one is open.
    if (!isTauri() || get().isCheckingApiKey) return;
    set({ isCheckingApiKey: true, apiKeyCheckError: null });
    try {
      const configured = await invoke<boolean>('has_ai_api_key', { provider: providerId });
      set((state) => ({
        apiKeysConfigured: { ...state.apiKeysConfigured, [providerId]: configured },
      }));
    } catch (err) {
      set({ apiKeyCheckError: `Could not check the saved key. OS credential access was denied or unavailable. Retry only when ready. (${String(err)})` });
    } finally { set({ isCheckingApiKey: false }); }
  },

  setProvider: (providerId) => {
    const providerPreset = AI_PROVIDERS.find((p) => p.id === providerId);
    if (!providerPreset) return;

    const currentConfig = get().aiConfig;
    const rememberedConfig = rememberActiveProviderSettings(currentConfig);
    const nextSettings = providerSettingsFor(rememberedConfig, providerId);
    const nextConfig: AiConfig = {
      ...rememberedConfig,
      ...nextSettings,
      provider: providerId,
      apiKey: '',
    };
    set({ aiConfig: nextConfig, aiTestResult: null });
    persistState(nextConfig, get().mcpServers, get().guardrailPolicy, get().externalAgents);

    // Selecting a provider never reads secrets or contacts a model endpoint.
  },

  testAiConnection: async (configOverride, apiKeyIsPresent = false) => {
    const aiConfig = configOverride || get().aiConfig;
    set({ isTestingAi: true, aiTestResult: null });

    const startTime = Date.now();

    try {
      // 2. Validation for providers requiring API Key
      if (
        aiConfig.provider !== 'ollama' &&
        !aiConfig.apiKey.trim() &&
        !apiKeyIsPresent &&
        !get().apiKeysConfigured[aiConfig.provider]
      ) {
        const res = {
          success: false,
          message: `API Key is required for ${aiConfig.provider.toUpperCase()}. Please enter a valid key.`,
          timestamp: Date.now(),
        };
        set({ isTestingAi: false, aiTestResult: res });
        return res;
      }

      // Live checks must report their actual transport/model result.
      if (aiConfig.provider === 'ollama') {
        const endpoint = getLocalOllamaEndpoint(aiConfig.baseUrl);
        if (!endpoint) {
          const res = {
            success: false,
            message: 'Ollama checks are limited to localhost. Use an http(s) URL on localhost, 127.0.0.1, or ::1 without embedded credentials.',
            timestamp: Date.now(),
          };
          set({ isTestingAi: false, aiTestResult: res });
          return res;
        }
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3500);

          const response = await fetch(endpoint, {
            method: 'GET',
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (response.ok) {
            const data = await response.json();
            const models = (data.models || []).map((m: { name: string }) => m.name);
            const latency = Date.now() - startTime;
            const res = {
              success: true,
              message: `Connected to Ollama daemon successfully (${latency}ms). Found ${models.length} local model(s). Active model: "${aiConfig.model}".`,
              timestamp: Date.now(),
            };
            set({ isTestingAi: false, aiTestResult: res });
            return res;
          } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
        } catch (fetchErr: unknown) {
          const latency = Date.now() - startTime;
          const msg =
            fetchErr instanceof Error && fetchErr.name === 'AbortError'
              ? 'Ollama daemon connection timed out.'
              : 'Unable to connect to Ollama. Is the local Ollama service running?';
          const res = {
            success: false,
            message: `${msg} (${latency}ms)`,
            timestamp: Date.now(),
          };
          set({ isTestingAi: false, aiTestResult: res });
          return res;
        }
      }

      if (isTauri()) {
        if (aiConfig.apiKey.trim()) {
          const res = { success: false, message: 'Apply API key changes before testing. Native checks use only the credential saved in the OS key store, not an unsaved draft.', timestamp: Date.now() };
          set({ isTestingAi: false, aiTestResult: res });
          return res;
        }
        const result = await invoke<{ success: boolean; message: string }>('test_ai_review_provider', {
          request: {
            sessionId: 'connection-check', provider: aiConfig.provider,
            authMode: 'api_key', model: aiConfig.model,
            baseUrl: aiConfig.baseUrl, instructions: '', allowRemote: true,
            reasoningEffort: aiConfig.reasoningEffort || null, fastMode: aiConfig.fastMode === true,
          },
        });
        const res = { ...result, timestamp: Date.now() };
        set({ isTestingAi: false, aiTestResult: res });
        return res;
      }

      // A regular browser cannot access the native key store or provider bridge.
      const providerName =
        AI_PROVIDERS.find((p) => p.id === aiConfig.provider)?.name || aiConfig.provider;

      const res = {
        success: false,
        message: `Live inference checks for ${providerName} are not available yet. No inference request was sent; credentials and model access have not been verified.`,
        timestamp: Date.now(),
      };

      set({ isTestingAi: false, aiTestResult: res });
      return res;
    } catch (err: unknown) {
      const latency = Date.now() - startTime;
      const res = {
        success: false,
        message: `Failed to test connection: ${err instanceof Error ? err.message : String(err)} (${latency}ms)`,
        timestamp: Date.now(),
      };
      set({ isTestingAi: false, aiTestResult: res });
      return res;
    }
  },

  clearAiTestResult: () => set({ aiTestResult: null }),

  fetchDynamicModels: async (configOverride) => {
    if (get().isFetchingDynamicModels) return { success: false, count: 0, error: 'A model refresh is already in progress.' };
    const config = configOverride || get().aiConfig;
    const provider = config.provider;
    if (config.apiKey?.trim()) return { success: false, count: 0, error: 'Apply API key changes before refreshing models.' };
    set({ isFetchingDynamicModels: true, dynamicModelError: null });

    try {
      if (isTauri()) {
        const models = await invoke<Array<{ id: string; name: string; description?: string }>>('fetch_ai_models', {
          provider,
          apiKey: null,
          baseUrl: config.baseUrl || null,
        });

        const presets: AiModelPreset[] = models.map((m) => ({
          id: m.id,
          name: m.name,
          recommendedFor: m.description,
        }));

        set((state) => ({
          dynamicModels: {
            ...state.dynamicModels,
            [provider]: presets,
          },
          isFetchingDynamicModels: false,
        }));

        return { success: true, count: presets.length };
      } else {
        const defaultPreset = AI_PROVIDERS.find((p) => p.id === provider);
        const fallback = defaultPreset?.models || [];
        set((state) => ({
          dynamicModels: {
            ...state.dynamicModels,
            [provider]: fallback,
          },
          isFetchingDynamicModels: false,
        }));
        return { success: true, count: fallback.length };
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      set({ isFetchingDynamicModels: false, dynamicModelError: errMsg });
      return { success: false, count: 0, error: errMsg };
    }
  },

  addMcpServer: (serverData) => {
    const id = `mcp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newServer: McpServerConfig = resetMcpVerification({
      ...serverData,
      id,
      enabled: serverData.enabled ?? true,
      testStatus: 'untested',
    });
    const nextServers = [...get().mcpServers, newServer];
    set({ mcpServers: nextServers });
    persistState(get().aiConfig, nextServers, get().guardrailPolicy, get().externalAgents);
  },

  updateMcpServer: (id, updates) => {
    const nextServers = get().mcpServers.map((s) =>
      s.id === id ? resetMcpVerification({ ...s, ...updates }) : s
    );
    set({ mcpServers: nextServers });
    persistState(get().aiConfig, nextServers, get().guardrailPolicy, get().externalAgents);
  },

  deleteMcpServer: (id) => {
    const nextServers = get().mcpServers.filter((s) => s.id !== id);
    set({ mcpServers: nextServers });
    persistState(get().aiConfig, nextServers, get().guardrailPolicy, get().externalAgents);
  },

  toggleMcpServer: (id) => {
    const nextServers = get().mcpServers.map((s) =>
      s.id === id ? resetMcpVerification({ ...s, enabled: !s.enabled }) : s
    );
    set({ mcpServers: nextServers });
    persistState(get().aiConfig, nextServers, get().guardrailPolicy, get().externalAgents);
  },

  testMcpServer: async (id) => {
    const server = get().mcpServers.find((s) => s.id === id);
    if (!server) {
      return { success: false, message: 'Server not found' };
    }

    const invalid = server.type === 'stdio' && !server.command.trim()
      ? 'Executable command cannot be empty for stdio.'
      : server.type !== 'stdio' && !server.url?.trim() ? 'HTTP URL cannot be empty.' : null;
    const message = invalid
      ? `Invalid local configuration: ${invalid} No server was contacted.`
      : MCP_TRANSPORT_UNAVAILABLE;
    // Config validation is not a transport handshake or tool discovery.
    const nextServers = get().mcpServers.map((item) => item.id === id ? {
      ...resetMcpVerification(item), testStatus: invalid ? 'failed' as const : 'unavailable' as const,
      testMessage: message,
    } : item);
    set({ mcpServers: nextServers });
    persistState(get().aiConfig, get().mcpServers, get().guardrailPolicy, get().externalAgents);
    return { success: false, message };
  },

  importMcpConfigFile: (jsonStr) => {
    try {
      const parsed = JSON.parse(jsonStr) as McpConfigFileFormat;
      if (!parsed || typeof parsed !== 'object') {
        return { success: false, count: 0, error: 'Invalid JSON format' };
      }

      let importedCount = 0;
      const currentServers = [...get().mcpServers];

      // Handle standard "mcpServers" object format (Claude Desktop / VSCode)
      if (parsed.mcpServers && typeof parsed.mcpServers === 'object') {
        for (const [key, conf] of Object.entries(parsed.mcpServers)) {
          const existingIdx = currentServers.findIndex(
            (s) => s.name.toLowerCase() === key.toLowerCase() || s.id === key
          );

          const isHttp = Boolean(conf.url);
          const serverEntry: McpServerConfig = {
            id: key,
            name: key,
            description: `Imported MCP Server: ${key}`,
            type: isHttp ? (conf.type === 'sse' ? 'sse' : 'http') : 'stdio',
            command: conf.command || '',
            args: Array.isArray(conf.args) ? conf.args : [],
            env: conf.env || {},
            url: conf.url,
            enabled: true,
            testStatus: 'untested',
          };

          if (existingIdx >= 0) {
            currentServers[existingIdx] = serverEntry;
          } else {
            currentServers.push(serverEntry);
          }
          importedCount++;
        }
      } else if (Array.isArray(parsed)) {
        // Direct array of servers
        for (const item of parsed) {
          if (item && item.name) {
            currentServers.push({
              ...resetMcpVerification(item),
              id: item.id || `mcp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            });
            importedCount++;
          }
        }
      } else {
        return {
          success: false,
          count: 0,
          error: 'JSON must contain an "mcpServers" object or an array of server configs',
        };
      }

      set({ mcpServers: currentServers });
      persistState(get().aiConfig, currentServers, get().guardrailPolicy, get().externalAgents);
      return { success: true, count: importedCount };
    } catch (e: unknown) {
      return {
        success: false,
        count: 0,
        error: e instanceof Error ? e.message : 'Invalid JSON file',
      };
    }
  },

  exportMcpConfigFile: () => {
    const { mcpServers } = get();
    const exportObj: McpConfigFileFormat = {
      mcpServers: {},
    };

    for (const server of mcpServers) {
      const env = publicMcpEnv(server.env ?? {}, server.secretEnvKeys ?? []);
      if (server.type !== 'stdio') {
        exportObj.mcpServers[server.name] = {
          type: server.type,
          url: server.url,
          env: Object.keys(env).length > 0 ? env : undefined,
        };
      } else {
        exportObj.mcpServers[server.name] = {
          type: 'stdio',
          command: server.command,
          args: server.args,
          env: Object.keys(env).length > 0 ? env : undefined,
        };
      }
    }

    return JSON.stringify(exportObj, null, 2);
  },

  // Guardrails Implementation
  loadGuardrailPolicy: async () => {
    if (!isTauri()) return;
    try {
      set({ isGuardrailLoading: true });
      const backendPolicy = await invoke<GuardrailPolicy>('get_guardrail_policy');
      if (backendPolicy) {
        set({ guardrailPolicy: backendPolicy });
        persistState(get().aiConfig, get().mcpServers, backendPolicy, get().externalAgents);
      }
    } catch (err) {
      console.warn('Failed to load guardrail policy from backend:', err);
    } finally {
      set({ isGuardrailLoading: false });
    }
  },

  updateGuardrailPolicy: async (partial) => {
    const nextPolicy: GuardrailPolicy = { ...get().guardrailPolicy, ...partial };
    set({ guardrailPolicy: nextPolicy });
    persistState(get().aiConfig, get().mcpServers, nextPolicy, get().externalAgents);
    if (isTauri()) {
      try {
        await invoke('update_guardrail_policy', { policy: nextPolicy });
      } catch (err) {
        console.error('Failed to sync guardrail policy to backend:', err);
      }
    }
  },

  resetGuardrailPolicy: async (mode) => {
    if (isTauri()) {
      try {
        const resetPolicy = await invoke<GuardrailPolicy>('reset_guardrail_policy', { mode });
        set({ guardrailPolicy: resetPolicy });
        persistState(get().aiConfig, get().mcpServers, resetPolicy, get().externalAgents);
        return;
      } catch (err) {
        console.warn('Failed to reset guardrail policy on backend:', err);
      }
    }
    const fallbackPolicy: GuardrailPolicy = { ...DEFAULT_GUARDRAIL_POLICY, mode };
    set({ guardrailPolicy: fallbackPolicy });
    persistState(get().aiConfig, get().mcpServers, fallbackPolicy, get().externalAgents);
  },

  loadGuardrailAuditLog: async (limit = 50) => {
    if (!isTauri()) return;
    try {
      const logs = await invoke<GuardrailAuditEvent[]>('get_guardrail_audit_log', { limit });
      set({ guardrailAuditLog: logs || [] });
    } catch (err) {
      console.warn('Failed to load guardrail audit log:', err);
    }
  },

  clearGuardrailAuditLog: async () => {
    if (isTauri()) {
      try {
        await invoke('clear_guardrail_audit_log');
      } catch (err) {
        console.warn('Failed to clear audit log:', err);
      }
    }
    set({ guardrailAuditLog: [] });
  },

  simulateGuardrailCheck: async (toolName, args) => {
    if (isTauri()) {
      try {
        const res = await invoke<GuardrailEvaluationResult>('simulate_guardrail_check', {
          toolName,
          arguments: args,
        });
        return res;
      } catch (err) {
        console.error('Failed to simulate guardrail check:', err);
      }
    }
    return {
      allowed: true,
      risk_score: 10,
      violations: [],
      requires_confirmation: false,
    };
  },
}));

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('stage0-preferences-updated', (event) => {
    const settings = (event as CustomEvent<Window['__STAGE0_PREFERENCES__']>).detail;
    const configured = settings?.ai;
    if (!configured || Object.keys(configured).length === 0) return;
    const aiConfig = configured.aiConfig && typeof configured.aiConfig === 'object'
      ? normalizeLoadedAiConfig(configured.aiConfig as Partial<AiConfig>)
      : useAiMcpStore.getState().aiConfig;
    const mcpServers = Array.isArray(configured.mcpServers)
      ? configured.mcpServers.map((server) => resetMcpVerification(server as McpServerConfig))
      : useAiMcpStore.getState().mcpServers;
    const guardrailPolicy = configured.guardrailPolicy && typeof configured.guardrailPolicy === 'object'
      ? { ...DEFAULT_GUARDRAIL_POLICY, ...(configured.guardrailPolicy as Partial<GuardrailPolicy>) }
      : useAiMcpStore.getState().guardrailPolicy;
    useAiMcpStore.setState({ aiConfig, mcpServers, guardrailPolicy, aiTestResult: null });
  });
}

function getLocalOllamaEndpoint(baseUrl: string): string | null {
  try {
    const url = new URL(baseUrl);
    const localHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      !localHosts.has(url.hostname.toLowerCase()) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      return null;
    }
    return `${url.toString().replace(/\/+$/, '')}/api/tags`;
  } catch {
    return null;
  }
}

// Safely defer background hydration to avoid blocking module evaluation on startup
if (typeof window !== 'undefined' && typeof window.setTimeout === 'function') {
  window.setTimeout(() => {
    if (isTauri()) {
      // Rehydrate the last committed policy before reading native state. Reading
      // the fresh backend's balanced default first would erase saved preferences.
      void (async () => {
        try {
          await invoke('commit_ai_preferences', {
            apiKeys: {},
            apiKeyRemovals: [],
            policy: initialState.guardrailPolicy,
            mcpEnvSecrets: {},
            mcpEnvRemovals: {},
          });
          await useAiMcpStore.getState().loadGuardrailPolicy();
        } catch {
          console.warn('Could not restore the saved guardrail policy; saved preferences were retained.');
        }
      })();
      void useAiMcpStore.getState().loadGuardrailAuditLog();
    }
  }, 150);
}
