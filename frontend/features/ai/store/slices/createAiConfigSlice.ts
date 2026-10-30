import { getApplicationServices } from '../../../../core/services/runtime/applicationRuntime';

import type { StateCreator } from 'zustand';
import { AI_PROVIDERS, DEFAULT_AI_CONFIG } from '../../constants/aiPresets';
import { loadPersistedState, persistState } from '../../services/aiMcpPersistence';
import { checkAiProviderConnection } from '../../services/checkAiProviderConnection';
import { type AiConfig } from '../../types/AiConfig';
import type { AiMcpState } from '../../types/AiMcpState';
import {
  activeProviderSettings,
  configuredProviderIds,
  providerSettingsFor,
  rememberActiveProviderSettings,
} from '../../utils/aiProviderSettings';
import { enrichDiscoveredModels, providerModelCatalogKey } from '../../utils/providerModelCatalog';

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
      if (keyToSave && getApplicationServices().platform.capabilities.keychain) {
        const provider = nextConfig.provider;
        void getApplicationServices().aiProviders.storeAiApiKey({
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
      if (getApplicationServices().platform.capabilities.keychain) {
        void getApplicationServices().aiProviders.deleteAiApiKey({ provider: currentProvider }).catch(() => {});
      }
    },

    loadApiKeyForProvider: async (providerId) => {
      // Explicit user action only. Status checks must not cascade into another
      // keyring read/model request, nor queue more prompts while one is open.
      if (!getApplicationServices().platform.capabilities.keychain || get().isCheckingApiKey) return;
      set({ isCheckingApiKey: true, apiKeyCheckError: null });
      try {
        const configured = await getApplicationServices().aiProviders.hasAiApiKey({
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

        const res = await checkAiProviderConnection(aiConfig, startTime);
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
      set({ isFetchingDynamicModels: true, dynamicModelError: null });

      try {
        const models = await getApplicationServices().aiProviders.fetchAiModels({
          provider,
          apiKey: config.apiKey?.trim() || null,
          baseUrl: config.baseUrl || null,
        });
        const catalog = enrichDiscoveredModels(provider, models.map((model) => ({
          id: model.id,
          name: model.name,
          recommendedFor: model.description,
          ...(model.reasoningEfforts ? { reasoningEfforts: model.reasoningEfforts } : {}),
          ...(model.supportsFastMode != null ? { supportsFastMode: model.supportsFastMode } : {}),
        })));
        const catalogKey = providerModelCatalogKey(provider, config.baseUrl || '');
        set((state) => ({
          dynamicModels: { ...state.dynamicModels, [catalogKey]: catalog },
          isFetchingDynamicModels: false,
        }));
        return { success: true, count: catalog.length, models: catalog };
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        set({ isFetchingDynamicModels: false, dynamicModelError: errMsg });
        return { success: false, count: 0, error: errMsg };
      }
    },
  });
