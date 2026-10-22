import { invoke, isTauri } from '@tauri-apps/api/core';
import type { StateCreator } from 'zustand';
import { AI_PROVIDERS, DEFAULT_AI_CONFIG } from '../../constants/aiPresets';
import { loadPersistedState, persistState } from '../../services/aiMcpPersistence';
import { type AiConfig } from '../../types/AiConfig';
import type { AiMcpState } from '../../types/AiMcpState';
import { type AiModelPreset } from '../../types/AiModelPreset';
import {
  activeProviderSettings,
  configuredProviderIds,
  providerSettingsFor,
  rememberActiveProviderSettings,
} from '../../utils/aiProviderSettings';

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

export const createAiConfigSlice =
  (
    initialState: ReturnType<typeof loadPersistedState>
  ): StateCreator<
    AiMcpState,
    [],
    [],
    Pick<
      AiMcpState,
      | 'aiConfig'
      | 'apiKeysConfigured'
      | 'isCheckingApiKey'
      | 'apiKeyCheckError'
      | 'isTestingAi'
      | 'aiTestResult'
      | 'activeSubTab'
      | 'dynamicModels'
      | 'isFetchingDynamicModels'
      | 'dynamicModelError'
      | 'setActiveSubTab'
      | 'updateAiConfig'
      | 'resetAiConfig'
      | 'loadApiKeyForProvider'
      | 'setProvider'
      | 'testAiConnection'
      | 'clearAiTestResult'
      | 'fetchDynamicModels'
    >
  > =>
  (set, get) => ({
    aiConfig: initialState.aiConfig,

    apiKeysConfigured: {},

    isCheckingApiKey: false,

    apiKeyCheckError: null,

    isTestingAi: false,

    aiTestResult: null,

    activeSubTab: 'ai',

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
      if (
        ['model', 'baseUrl', 'reasoningEffort', 'fastMode'].some((key) => key in safePartial) &&
        configuredProviderIds(nextConfig).includes(nextConfig.provider)
      ) {
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
        })
          .then(() => {
            set((state) => ({
              apiKeysConfigured: { ...state.apiKeysConfigured, [provider]: true },
            }));
          })
          .catch((err) => {
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
      persistState(
        DEFAULT_AI_CONFIG,
        get().mcpServers,
        get().guardrailPolicy,
        get().externalAgents
      );
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
        const configured = await invoke<boolean>('has_ai_api_key', {
          provider: providerId,
        });
        set((state) => ({
          apiKeysConfigured: { ...state.apiKeysConfigured, [providerId]: configured },
        }));
      } catch (err) {
        set({
          apiKeyCheckError: `Could not check the saved key. OS credential access was denied or unavailable. Retry only when ready. (${String(err)})`,
        });
      } finally {
        set({ isCheckingApiKey: false });
      }
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
              message:
                'Ollama checks are limited to localhost. Use an http(s) URL on localhost, 127.0.0.1, or ::1 without embedded credentials.',
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
            const res = {
              success: false,
              message:
                'Apply API key changes before testing. Native checks use only the credential saved in the OS key store, not an unsaved draft.',
              timestamp: Date.now(),
            };
            set({ isTestingAi: false, aiTestResult: res });
            return res;
          }
          const result = await invoke<{ success: boolean; message: string }>(
            'test_ai_review_provider',
            {
              request: {
                sessionId: 'connection-check',
                provider: aiConfig.provider,
                authMode: 'api_key',
                model: aiConfig.model,
                baseUrl: aiConfig.baseUrl,
                instructions: '',
                allowRemote: true,
                reasoningEffort: aiConfig.reasoningEffort || null,
                fastMode: aiConfig.fastMode === true,
              },
            }
          );
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
      if (get().isFetchingDynamicModels)
        return {
          success: false,
          count: 0,
          error: 'A model refresh is already in progress.',
        };
      const config = configOverride || get().aiConfig;
      const provider = config.provider;
      if (config.apiKey?.trim())
        return {
          success: false,
          count: 0,
          error: 'Apply API key changes before refreshing models.',
        };
      set({ isFetchingDynamicModels: true, dynamicModelError: null });

      try {
        if (isTauri()) {
          const models = await invoke<Array<{ id: string; name: string; description?: string }>>(
            'fetch_ai_models',
            {
              provider,
              apiKey: null,
              baseUrl: config.baseUrl || null,
            }
          );

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
  });
