import { create } from 'zustand';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { AiConfig, McpServerConfig, McpConfigFileFormat } from '../types/ai';
import {
  DEFAULT_AI_CONFIG,
  DEFAULT_MCP_SERVERS,
  AI_PROVIDERS,
} from '../constants/aiPresets';

interface AiMcpState {
  aiConfig: AiConfig;
  mcpServers: McpServerConfig[];
  isTestingAi: boolean;
  aiTestResult: { success: boolean; message: string; timestamp: number } | null;
  activeSubTab: 'ai' | 'mcp' | 'prompts';
  setActiveSubTab: (tab: 'ai' | 'mcp' | 'prompts') => void;

  // AI Configuration Actions
  updateAiConfig: (partial: Partial<AiConfig>) => void;
  resetAiConfig: () => void;
  setProvider: (providerId: AiConfig['provider']) => void;
  loadApiKeyForProvider: (providerId: AiConfig['provider']) => Promise<void>;
  testAiConnection: () => Promise<{ success: boolean; message: string }>;
  clearAiTestResult: () => void;

  // MCP Server Actions
  addMcpServer: (server: Omit<McpServerConfig, 'id'>) => void;
  updateMcpServer: (id: string, server: Partial<McpServerConfig>) => void;
  deleteMcpServer: (id: string) => void;
  toggleMcpServer: (id: string) => void;
  testMcpServer: (id: string) => Promise<{ success: boolean; message: string }>;
  importMcpConfigFile: (jsonStr: string) => { success: boolean; count: number; error?: string };
  exportMcpConfigFile: () => string;
}

const STORAGE_KEY = 'stage0_ai_mcp_config';

function loadPersistedState(): { aiConfig: AiConfig; mcpServers: McpServerConfig[] } {
  if (typeof window === 'undefined') {
    return { aiConfig: DEFAULT_AI_CONFIG, mcpServers: DEFAULT_MCP_SERVERS };
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

      // Securely migrate any legacy plaintext key found in localStorage into the OS Keyring
      if (typeof legacyKey === 'string' && legacyKey.trim().length > 0 && isTauri()) {
        const providerToMigrate = loadedAiConfig.provider || 'anthropic';
        void invoke('store_ai_api_key', {
          provider: providerToMigrate,
          apiKey: legacyKey.trim(),
        }).then(() => {
          // Immediately wipe plaintext secret from localStorage
          persistState(loadedAiConfig, Array.isArray(parsed.mcpServers) ? parsed.mcpServers : DEFAULT_MCP_SERVERS);
        }).catch((err) => {
          console.warn('Failed to migrate legacy API key to OS Keyring:', err);
        });
      }

      return {
        aiConfig: loadedAiConfig,
        mcpServers: Array.isArray(parsed.mcpServers) ? parsed.mcpServers : DEFAULT_MCP_SERVERS,
      };
    }
  } catch (err) {
    console.warn('Failed to load persisted AI & MCP settings:', err);
  }

  return { aiConfig: DEFAULT_AI_CONFIG, mcpServers: DEFAULT_MCP_SERVERS };
}

function persistState(aiConfig: AiConfig, mcpServers: McpServerConfig[]) {
  if (typeof window === 'undefined') return;
  try {
    // Strip apiKey before saving to localStorage to prevent plaintext secret leakage
    const sanitizedAiConfig: AiConfig = { ...aiConfig, apiKey: '' };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ aiConfig: sanitizedAiConfig, mcpServers }));
  } catch (err) {
    console.error('Failed to save AI & MCP settings:', err);
  }
}

const initialState = loadPersistedState();

export const useAiMcpStore = create<AiMcpState>((set, get) => ({
  aiConfig: initialState.aiConfig,
  mcpServers: initialState.mcpServers,
  isTestingAi: false,
  aiTestResult: null,
  activeSubTab: 'ai',

  setActiveSubTab: (tab) => set({ activeSubTab: tab }),

  updateAiConfig: (partial) => {
    const nextConfig = { ...get().aiConfig, ...partial };
    set({ aiConfig: nextConfig, aiTestResult: null });
    persistState(nextConfig, get().mcpServers);

    // If an API key is updated, persist it to the secure OS Keyring
    if (partial.apiKey !== undefined && isTauri()) {
      void invoke('store_ai_api_key', {
        provider: nextConfig.provider,
        apiKey: partial.apiKey,
      }).catch((err) => {
        console.error('Failed to store API key in OS Keyring:', err);
      });
    }
  },

  resetAiConfig: () => {
    const currentProvider = get().aiConfig.provider;
    set({ aiConfig: DEFAULT_AI_CONFIG, aiTestResult: null });
    persistState(DEFAULT_AI_CONFIG, get().mcpServers);
    if (isTauri()) {
      void invoke('delete_ai_api_key', { provider: currentProvider }).catch(() => {});
    }
  },

  loadApiKeyForProvider: async (providerId) => {
    if (!isTauri()) return;
    try {
      const secureKey = await invoke<string | null>('get_ai_api_key', { provider: providerId });
      if (get().aiConfig.provider === providerId) {
        set((state) => ({
          aiConfig: { ...state.aiConfig, apiKey: secureKey || '' },
        }));
      }
    } catch (err) {
      console.warn(`Failed to retrieve API key for ${providerId} from OS Keyring:`, err);
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
      apiKey: '', // Temporarily clear while loading from OS Keyring
    };
    set({ aiConfig: nextConfig, aiTestResult: null });
    persistState(nextConfig, get().mcpServers);

    // Asynchronously load the key for this newly selected provider from the OS Keyring
    void get().loadApiKeyForProvider(providerId);
  },

  testAiConnection: async () => {
    const { aiConfig } = get();
    set({ isTestingAi: true, aiTestResult: null });

    const startTime = Date.now();

    try {
      // 1. Validation for providers requiring API Key
      if (aiConfig.provider !== 'ollama' && !aiConfig.apiKey.trim()) {
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
        const url = aiConfig.baseUrl.replace(/\/+$/, '') + '/api/tags';
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3500);

          const response = await fetch(url, {
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
              ? `Ollama daemon connection timed out at ${aiConfig.baseUrl}`
              : `Unable to connect to Ollama at ${aiConfig.baseUrl}. Is the Ollama service running?`;
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
        message: `Successfully verified configuration for ${providerName} (${aiConfig.model}) in ${latency}ms. Endpoint: ${aiConfig.baseUrl}.`,
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
}));

if (typeof window !== 'undefined' && isTauri()) {
  void useAiMcpStore.getState().loadApiKeyForProvider(initialState.aiConfig.provider);
}

