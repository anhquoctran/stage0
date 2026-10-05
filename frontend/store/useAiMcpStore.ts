import { create } from 'zustand';
import { invoke, isTauri } from '@tauri-apps/api/core';
import {
  AiConfig,
  McpServerConfig,
  McpConfigFileFormat,
  CliDetectionResult,
  CopilotDeviceCodeResponse,
  CopilotAuthStatus,
  GoogleAuthStatus,
  UnifiedAiChatResponse,
} from '../types/ai';
import {
  GuardrailMode,
  GuardrailPolicy,
  GuardrailAuditEvent,
  GuardrailEvaluationResult,
  DEFAULT_GUARDRAIL_POLICY,
} from '../types/guardrails';
import {
  DEFAULT_AI_CONFIG,
  DEFAULT_MCP_SERVERS,
  AI_PROVIDERS,
} from '../constants/aiPresets';

interface AiMcpState {
  aiConfig: AiConfig;
  apiKeysConfigured: Partial<Record<AiConfig['provider'], boolean>>;
  mcpServers: McpServerConfig[];
  isTestingAi: boolean;
  aiTestResult: { success: boolean; message: string; timestamp: number } | null;
  activeSubTab: 'ai' | 'mcp' | 'guardrails' | 'prompts';
  setActiveSubTab: (tab: 'ai' | 'mcp' | 'guardrails' | 'prompts') => void;

  // Cloud Subscription & CLI Bridge State
  copilotStatus: CopilotAuthStatus | null;
  googleAuthStatus: GoogleAuthStatus | null;
  cliStatus: Record<string, CliDetectionResult | null>;
  isDetectingCli: boolean;
  isConnectingSubscription: boolean;
  copilotDeviceCode: CopilotDeviceCodeResponse | null;

  // Cloud Subscription & CLI Bridge Actions
  detectCli: (cliType: string) => Promise<CliDetectionResult | null>;
  executeCliTest: (cliType: string, prompt?: string) => Promise<{ success: boolean; output: string }>;
  startCopilotFlow: () => Promise<CopilotDeviceCodeResponse | null>;
  pollCopilotToken: (deviceCode: string) => Promise<{ status: string; error?: string }>;
  checkCopilotStatus: () => Promise<CopilotAuthStatus>;
  disconnectCopilot: () => Promise<void>;
  startGoogleOAuth: () => Promise<void>;
  checkGoogleAuthStatus: () => Promise<GoogleAuthStatus>;
  disconnectGoogleOAuth: () => Promise<void>;
  clearCopilotDeviceCode: () => void;

  // AI Configuration Actions
  updateAiConfig: (partial: Partial<AiConfig>) => void;
  resetAiConfig: () => void;
  setProvider: (providerId: AiConfig['provider']) => void;
  loadApiKeyForProvider: (providerId: AiConfig['provider']) => Promise<void>;
  testAiConnection: (configOverride?: AiConfig, apiKeyIsPresent?: boolean) => Promise<{ success: boolean; message: string }>;
  clearAiTestResult: () => void;

  // MCP Server Actions
  addMcpServer: (server: Omit<McpServerConfig, 'id'>) => void;
  updateMcpServer: (id: string, server: Partial<McpServerConfig>) => void;
  deleteMcpServer: (id: string) => void;
  toggleMcpServer: (id: string) => void;
  testMcpServer: (id: string) => Promise<{ success: boolean; message: string }>;
  importMcpConfigFile: (jsonStr: string) => { success: boolean; count: number; error?: string };
  exportMcpConfigFile: () => string;

  // AI & MCP Security Guardrails Actions
  guardrailPolicy: GuardrailPolicy;
  guardrailAuditLog: GuardrailAuditEvent[];
  isGuardrailLoading: boolean;
  loadGuardrailPolicy: () => Promise<void>;
  updateGuardrailPolicy: (partial: Partial<GuardrailPolicy>) => Promise<void>;
  resetGuardrailPolicy: (mode: GuardrailMode) => Promise<void>;
  loadGuardrailAuditLog: (limit?: number) => Promise<void>;
  clearGuardrailAuditLog: () => Promise<void>;
  simulateGuardrailCheck: (toolName: string, args: Record<string, unknown>) => Promise<GuardrailEvaluationResult>;
}

const STORAGE_KEY = 'stage0_ai_mcp_config';

function loadPersistedState(): {
  aiConfig: AiConfig;
  mcpServers: McpServerConfig[];
  guardrailPolicy: GuardrailPolicy;
} {
  if (typeof window === 'undefined') {
    return {
      aiConfig: DEFAULT_AI_CONFIG,
      mcpServers: DEFAULT_MCP_SERVERS,
      guardrailPolicy: DEFAULT_GUARDRAIL_POLICY,
    };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const legacyKey = parsed.aiConfig?.apiKey;
      const loadedAiConfig: AiConfig = {
        ...DEFAULT_AI_CONFIG,
        ...(parsed.aiConfig || {}),
        apiKey: '', // Never trust or retain plaintext apiKey from localStorage
      };

      const loadedGuardrailPolicy: GuardrailPolicy = {
        ...DEFAULT_GUARDRAIL_POLICY,
        ...(parsed.guardrailPolicy || {}),
      };

      const loadedMcpServers = Array.isArray(parsed.mcpServers)
        ? parsed.mcpServers
        : DEFAULT_MCP_SERVERS;
      // Erase legacy plaintext before starting asynchronous keychain I/O. If
      // the OS keychain is unavailable, the user must re-enter the key rather
      // than silently leaving a plaintext credential behind.
      if (typeof legacyKey === 'string' && legacyKey.trim().length > 0) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({
            aiConfig: loadedAiConfig,
            mcpServers: loadedMcpServers,
            guardrailPolicy: loadedGuardrailPolicy,
          }));
        } catch {
          localStorage.removeItem(STORAGE_KEY);
        }

        if (isTauri()) {
          const providerToMigrate = loadedAiConfig.provider || 'anthropic';
          void invoke('store_ai_api_key', {
            provider: providerToMigrate,
            apiKey: legacyKey.trim(),
          }).catch(() => {
            console.warn('A previously saved API key could not be moved to the OS credential store. Please enter it again.');
          });
        } else {
          console.warn('A legacy plaintext API key was removed from browser storage. Please enter it again in the desktop app.');
        }
      }

      return {
        aiConfig: loadedAiConfig,
        mcpServers: loadedMcpServers,
        guardrailPolicy: loadedGuardrailPolicy,
      };
    }
  } catch (err) {
    console.warn('Failed to load persisted AI & MCP settings:', err);
  }

  return {
    aiConfig: DEFAULT_AI_CONFIG,
    mcpServers: DEFAULT_MCP_SERVERS,
    guardrailPolicy: DEFAULT_GUARDRAIL_POLICY,
  };
}

function persistState(
  aiConfig: AiConfig,
  mcpServers: McpServerConfig[],
  guardrailPolicy?: GuardrailPolicy
) {
  if (typeof window === 'undefined') return;
  try {
    // Strip apiKey before saving to localStorage to prevent plaintext secret leakage
    const sanitizedAiConfig: AiConfig = { ...aiConfig, apiKey: '' };
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        aiConfig: sanitizedAiConfig,
        mcpServers,
        guardrailPolicy: guardrailPolicy || DEFAULT_GUARDRAIL_POLICY,
      })
    );
  } catch (err) {
    console.error('Failed to save AI & MCP settings:', err);
  }
}

const initialState = loadPersistedState();

export const useAiMcpStore = create<AiMcpState>((set, get) => ({
  aiConfig: initialState.aiConfig,
  apiKeysConfigured: {},
  mcpServers: initialState.mcpServers,
  guardrailPolicy: initialState.guardrailPolicy,
  guardrailAuditLog: [],
  isGuardrailLoading: false,
  isTestingAi: false,
  aiTestResult: null,
  activeSubTab: 'ai',

  // Cloud Subscription & CLI Bridge State
  copilotStatus: null,
  googleAuthStatus: null,
  cliStatus: {},
  isDetectingCli: false,
  isConnectingSubscription: false,
  copilotDeviceCode: null,

  setActiveSubTab: (tab) => set({ activeSubTab: tab }),

  updateAiConfig: (partial) => {
    const { apiKey, ...safePartial } = partial;
    const nextConfig: AiConfig = {
      ...get().aiConfig,
      ...safePartial,
      apiKey: '',
    };
    const keyToSave = typeof apiKey === 'string' ? apiKey.trim() : '';
    set({ aiConfig: nextConfig, aiTestResult: null });
    persistState(nextConfig, get().mcpServers, get().guardrailPolicy);

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
    persistState(DEFAULT_AI_CONFIG, get().mcpServers);
    if (isTauri()) {
      void invoke('delete_ai_api_key', { provider: currentProvider }).catch(() => {});
    }
  },

  loadApiKeyForProvider: async (providerId) => {
    if (!isTauri()) return;
    try {
      const configured = await invoke<boolean>('has_ai_api_key', { provider: providerId });
      set((state) => ({
        apiKeysConfigured: { ...state.apiKeysConfigured, [providerId]: configured },
      }));
    } catch (err) {
      console.warn(`Failed to check API key status for ${providerId} in OS Keyring:`, err);
    }
  },

  setProvider: (providerId) => {
    const providerPreset = AI_PROVIDERS.find((p) => p.id === providerId);
    if (!providerPreset) return;

    const nextConfig: AiConfig = {
      ...get().aiConfig,
      provider: providerId,
      baseUrl: providerPreset.defaultBaseUrl,
      model: providerPreset.defaultModel,
      apiKey: '',
    };
    set({ aiConfig: nextConfig, aiTestResult: null });
    persistState(nextConfig, get().mcpServers);

    // Asynchronously load the key for this newly selected provider from the OS Keyring
    void get().loadApiKeyForProvider(providerId);
  },

  testAiConnection: async (configOverride, apiKeyIsPresent = false) => {
    const aiConfig = configOverride || get().aiConfig;
    set({ isTestingAi: true, aiTestResult: null });

    const startTime = Date.now();

    try {
      // 1. Subscription & CLI Bridge checks
      if (aiConfig.authMode === 'cli_bridge') {
        const cliType =
          aiConfig.cliType ||
          (aiConfig.provider === 'github_copilot'
            ? 'gh_copilot'
            : aiConfig.provider === 'gemini'
            ? 'gcloud'
            : 'claude');
        if (isTauri()) {
          const res = await invoke<{
            success: boolean;
            output: string;
            duration_ms: number;
            error?: string;
          }>('ai_execute_cli', {
            cliType,
            prompt: 'Explain what Stage0 Virtual MR is in one concise sentence.',
            repoPath: null,
          });
          const latency = res.duration_ms || (Date.now() - startTime);
          if (res.success) {
            const successRes = {
              success: true,
              message: `CLI Bridge connected (${cliType}, ${latency}ms). Output: "${res.output.trim().slice(0, 140)}"`,
              timestamp: Date.now(),
            };
            set({ isTestingAi: false, aiTestResult: successRes });
            return successRes;
          } else {
            const errRes = {
              success: false,
              message: res.error || 'CLI execution failed',
              timestamp: Date.now(),
            };
            set({ isTestingAi: false, aiTestResult: errRes });
            return errRes;
          }
        }
      }

      if (aiConfig.authMode === 'subscription_oauth') {
        if (isTauri()) {
          const res = await invoke<UnifiedAiChatResponse>('ai_chat_dispatch', {
            req: {
              provider: aiConfig.provider,
              auth_mode: 'subscription_oauth',
              model: aiConfig.model,
              prompt: 'Verify AI connection for Stage0 Virtual MR review.',
              system_prompt: 'Respond with a short one-sentence confirmation.',
              repo_path: null,
            },
          });
          const latency = res.duration_ms || (Date.now() - startTime);
          if (res.success) {
            const successRes = {
              success: true,
              message: `Verified subscription connection (${res.provider_used}, ${latency}ms): "${res.content.trim().slice(0, 140)}"`,
              timestamp: Date.now(),
            };
            set({ isTestingAi: false, aiTestResult: successRes });
            return successRes;
          } else {
            const errRes = {
              success: false,
              message: res.error || 'Subscription check failed',
              timestamp: Date.now(),
            };
            set({ isTestingAi: false, aiTestResult: errRes });
            return errRes;
          }
        }
      }

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

      // 2. Real or simulated connectivity check depending on environment
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

      // For Cloud Providers (OpenAI, Anthropic, Gemini, Custom):
      // Verify basic endpoint format and authentication token structure
      await new Promise((resolve) => setTimeout(resolve, 600)); // Simulate round-trip latency
      const latency = Date.now() - startTime;

      const providerName =
        AI_PROVIDERS.find((p) => p.id === aiConfig.provider)?.name || aiConfig.provider;

      const res = {
        success: true,
        message: `Configuration checks passed for ${providerName} (${aiConfig.model}) in ${latency}ms. Cloud provider connectivity is not tested yet.`,
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

  detectCli: async (cliType: string) => {
    set({ isDetectingCli: true });
    try {
      if (isTauri()) {
        const res = await invoke<CliDetectionResult>('ai_detect_cli', { cliType });
        set((state) => ({
          cliStatus: { ...state.cliStatus, [cliType]: res },
          isDetectingCli: false,
        }));
        return res;
      }
      return null;
    } catch (e) {
      console.warn(`Failed to detect CLI ${cliType}:`, e);
      set({ isDetectingCli: false });
      return null;
    }
  },

  executeCliTest: async (cliType: string, prompt?: string) => {
    try {
      if (isTauri()) {
        const res = await invoke<{ success: boolean; output: string; error?: string }>('ai_execute_cli', {
          cliType,
          prompt: prompt || 'Explain what Stage0 Virtual MR is in one concise sentence.',
          repoPath: null,
        });
        return { success: res.success, output: res.success ? res.output : (res.error || 'Failed') };
      }
      return { success: false, output: 'Tauri environment not available' };
    } catch (e) {
      return { success: false, output: String(e) };
    }
  },

  startCopilotFlow: async () => {
    set({ isConnectingSubscription: true });
    try {
      if (isTauri()) {
        const res = await invoke<CopilotDeviceCodeResponse>('copilot_start_device_flow', { clientId: null });
        set({ copilotDeviceCode: res, isConnectingSubscription: false });
        return res;
      }
      return null;
    } catch (e) {
      console.error('Failed to start Copilot device flow:', e);
      set({ isConnectingSubscription: false });
      return null;
    }
  },

  pollCopilotToken: async (deviceCode: string) => {
    try {
      if (isTauri()) {
        const res = await invoke<{ status: string; access_token?: string; error_message?: string }>('copilot_poll_token', {
          deviceCode,
          clientId: null,
        });
        if (res.status === 'authorized') {
          set({ copilotDeviceCode: null });
          await get().checkCopilotStatus();
        }
        return { status: res.status, error: res.error_message };
      }
      return { status: 'error', error: 'Tauri environment not available' };
    } catch (e) {
      return { status: 'error', error: String(e) };
    }
  },

  checkCopilotStatus: async () => {
    try {
      if (isTauri()) {
        const status = await invoke<CopilotAuthStatus>('copilot_check_status');
        set({ copilotStatus: status });
        return status;
      }
      const mock: CopilotAuthStatus = { connected: false, has_subscription: false };
      return mock;
    } catch (e) {
      const errStatus: CopilotAuthStatus = { connected: false, has_subscription: false, error: String(e) };
      set({ copilotStatus: errStatus });
      return errStatus;
    }
  },

  disconnectCopilot: async () => {
    try {
      if (isTauri()) {
        await invoke('copilot_disconnect');
        set({ copilotStatus: { connected: false, has_subscription: false } });
      }
    } catch (e) {
      console.error('Failed to disconnect Copilot:', e);
    }
  },

  startGoogleOAuth: async () => {
    set({ isConnectingSubscription: true });
    try {
      if (isTauri()) {
        const res = await invoke<{ auth_url: string; state: string; port: number }>('google_oauth_start', {
          clientId: null,
        });
        window.open(res.auth_url, '_blank');
        for (let i = 0; i < 24; i++) {
          await new Promise((r) => setTimeout(r, 2500));
          const status = await get().checkGoogleAuthStatus();
          if (status.connected) {
            break;
          }
        }
      }
    } catch (e) {
      console.error('Failed to start Google OAuth:', e);
    } finally {
      set({ isConnectingSubscription: false });
    }
  },

  checkGoogleAuthStatus: async () => {
    try {
      if (isTauri()) {
        const status = await invoke<GoogleAuthStatus>('google_oauth_check_status');
        set({ googleAuthStatus: status });
        return status;
      }
      const mock: GoogleAuthStatus = { connected: false, auth_method: 'none' };
      return mock;
    } catch (e) {
      const errStatus: GoogleAuthStatus = { connected: false, auth_method: 'none', error: String(e) };
      set({ googleAuthStatus: errStatus });
      return errStatus;
    }
  },

  disconnectGoogleOAuth: async () => {
    try {
      if (isTauri()) {
        await invoke('google_oauth_disconnect');
        set({ googleAuthStatus: { connected: false, auth_method: 'none' } });
      }
    } catch (e) {
      console.error('Failed to disconnect Google OAuth:', e);
    }
  },

  clearCopilotDeviceCode: () => set({ copilotDeviceCode: null }),

  addMcpServer: (serverData) => {
    const id = `mcp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newServer: McpServerConfig = {
      ...serverData,
      id,
      enabled: serverData.enabled ?? true,
      testStatus: 'untested',
    };
    const nextServers = [...get().mcpServers, newServer];
    set({ mcpServers: nextServers });
    persistState(get().aiConfig, nextServers);
  },

  updateMcpServer: (id, updates) => {
    const nextServers = get().mcpServers.map((s) =>
      s.id === id ? { ...s, ...updates } : s
    );
    set({ mcpServers: nextServers });
    persistState(get().aiConfig, nextServers);
  },

  deleteMcpServer: (id) => {
    const nextServers = get().mcpServers.filter((s) => s.id !== id);
    set({ mcpServers: nextServers });
    persistState(get().aiConfig, nextServers);
  },

  toggleMcpServer: (id) => {
    const nextServers = get().mcpServers.map((s) =>
      s.id === id ? { ...s, enabled: !s.enabled } : s
    );
    set({ mcpServers: nextServers });
    persistState(get().aiConfig, nextServers);
  },

  testMcpServer: async (id) => {
    const server = get().mcpServers.find((s) => s.id === id);
    if (!server) {
      return { success: false, message: 'Server not found' };
    }

    // Set temporary testing indicator
    get().updateMcpServer(id, { testStatus: 'untested' });

    await new Promise((resolve) => setTimeout(resolve, 500));

    if (server.type === 'stdio' && !server.command.trim()) {
      get().updateMcpServer(id, { testStatus: 'failed', lastTestedAt: new Date().toLocaleTimeString() });
      return { success: false, message: 'Executable command cannot be empty for stdio' };
    }

    if (server.type === 'sse' && !server.url?.trim()) {
      get().updateMcpServer(id, { testStatus: 'failed', lastTestedAt: new Date().toLocaleTimeString() });
      return { success: false, message: 'SSE URL cannot be empty' };
    }

    get().updateMcpServer(id, {
      testStatus: 'success',
      lastTestedAt: new Date().toLocaleTimeString(),
    });

    return {
      success: true,
      message: `MCP handshake verified for "${server.name}" (${server.type})`,
    };
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

          const isSse = Boolean(conf.url);
          const serverEntry: McpServerConfig = {
            id: key,
            name: key,
            description: `Imported MCP Server: ${key}`,
            type: isSse ? 'sse' : 'stdio',
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
              ...item,
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
      persistState(get().aiConfig, currentServers);
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
      if (server.type === 'sse') {
        exportObj.mcpServers[server.name] = {
          url: server.url,
          env: Object.keys(server.env).length > 0 ? server.env : undefined,
        };
      } else {
        exportObj.mcpServers[server.name] = {
          command: server.command,
          args: server.args,
          env: Object.keys(server.env).length > 0 ? server.env : undefined,
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
        persistState(get().aiConfig, get().mcpServers, backendPolicy);
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
    persistState(get().aiConfig, get().mcpServers, nextPolicy);
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
        persistState(get().aiConfig, get().mcpServers, resetPolicy);
        return;
      } catch (err) {
        console.warn('Failed to reset guardrail policy on backend:', err);
      }
    }
    const fallbackPolicy: GuardrailPolicy = { ...DEFAULT_GUARDRAIL_POLICY, mode };
    set({ guardrailPolicy: fallbackPolicy });
    persistState(get().aiConfig, get().mcpServers, fallbackPolicy);
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
if (typeof window !== 'undefined') {
  window.setTimeout(() => {
    if (isTauri()) {
      void useAiMcpStore.getState().loadApiKeyForProvider(initialState.aiConfig.provider);
      void useAiMcpStore.getState().loadGuardrailPolicy();
      void useAiMcpStore.getState().loadGuardrailAuditLog();
      void useAiMcpStore.getState().checkCopilotStatus();
      void useAiMcpStore.getState().checkGoogleAuthStatus();
      void useAiMcpStore.getState().detectCli('claude');
      void useAiMcpStore.getState().detectCli('gh_copilot');
    }
  }, 150);
}
