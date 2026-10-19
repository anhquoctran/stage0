import { create } from 'zustand';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { type AiConfig } from '../types/AiConfig';
import { type AiModelPreset } from '../types/AiModelPreset';
import { type McpServerConfig } from '../types/McpServerConfig';
import { type McpConfigFileFormat } from '../types/McpConfigFileFormat';
import { type CliDetectionResult } from '../types/CliDetectionResult';
import { type CopilotDeviceCodeResponse } from '../types/CopilotDeviceCodeResponse';
import { type CopilotAuthStatus } from '../types/CopilotAuthStatus';
import { type GoogleAuthStatus } from '../types/GoogleAuthStatus';
import { type ChatGptAuthStatus } from '../types/ChatGptAuthStatus';
import { type UnifiedAiChatResponse } from '../types/UnifiedAiChatResponse';
import { type GuardrailPolicy } from '../types/GuardrailPolicy';
import { type GuardrailAuditEvent } from '../types/GuardrailAuditEvent';
import { type GuardrailEvaluationResult } from '../types/GuardrailEvaluationResult';
import { DEFAULT_GUARDRAIL_POLICY } from '../types/guardrails';
import { DEFAULT_AI_CONFIG, DEFAULT_MCP_SERVERS, AI_PROVIDERS } from '../constants/aiPresets';
import type { AiMcpState } from '../types/AiMcpState';
import { MCP_TRANSPORT_UNAVAILABLE } from '../constants/runtimeAvailability';
import { resetMcpVerification } from '../utils/resetMcpVerification';

const STORAGE_KEY = 'stage0_ai_mcp_config';
const LEGACY_DEFAULT_AI_SYSTEM_PROMPT = `You are an expert software engineer and code reviewer embedded in Stage0 Git Reviewer.
When reviewing git diffs:
1. Identify logic flaws, subtle edge cases, concurrency hazards, and security issues.
2. Recommend idiomatic, performant patterns conforming to the language standard.
3. Be clear, constructive, and concise. Avoid superfluous praise.
4. Format markdown with code blocks, line references, and actionable improvements.`;
let chatGptEpoch = 0;
let chatGptPoll = 0;

function publicChatGptStatus(value: ChatGptAuthStatus): ChatGptAuthStatus {
  if (!value || typeof value.connected !== 'boolean' || !['pending', 'signed_in', 'signed_out', 'failed', 'cancelled'].includes(value.phase || '') || !Array.isArray(value.profiles)) throw new Error('Invalid ChatGPT browser authentication status.');
  return {
    connected: value.connected, phase: value.phase,
    account_email: typeof value.account_email === 'string' ? value.account_email : undefined,
    error: typeof value.error === 'string' ? value.error : undefined,
    attempt_id: value.phase === 'pending' && typeof value.attempt_id === 'string' ? value.attempt_id : null,
    active_profile_id: typeof value.active_profile_id === 'string' ? value.active_profile_id : null,
    plan_usage_enabled: value.connected && value.plan_usage_enabled === true,
    credentials_loaded: value.credentials_loaded === true,
    profiles: value.profiles.slice(0, 12).filter((profile) => typeof profile.id === 'string' && typeof profile.label === 'string').map((profile) => ({ id: profile.id, label: profile.label, email: typeof profile.email === 'string' ? profile.email : null, signed_in: profile.signed_in === true })),
  };
}

async function chatGptAction(command: string, args: Record<string, unknown> | undefined, set: (value: Partial<AiMcpState>) => void, get: () => AiMcpState): Promise<void> {
  if (get().isConnectingSubscription) return;
  const epoch = ++chatGptEpoch;
  set({ isConnectingSubscription: true });
  try {
    if (!isTauri()) throw new Error('ChatGPT browser sign-in requires the native Stage0 app. No Codex CLI is required.');
    const status = publicChatGptStatus(await invoke<ChatGptAuthStatus>(command, args));
    if (epoch === chatGptEpoch) set({ chatgptAuthStatus: status });
  } catch (error) {
    const previous = get().chatgptAuthStatus;
    let recovered: ChatGptAuthStatus = { ...previous, connected: false, plan_usage_enabled: false, phase: previous?.phase === 'pending' ? 'pending' : 'failed', attempt_id: previous?.phase === 'pending' ? previous.attempt_id : null };
    // A failed action can have partially completed (for example local sign-out).
    // Re-read metadata only; never retry authorization or restore an old connected flag.
    if (isTauri() && epoch === chatGptEpoch) {
      try { recovered = publicChatGptStatus(await invoke<ChatGptAuthStatus>('chatgpt_oauth_check_status')); } catch {}
    }
    if (epoch === chatGptEpoch) set({ chatgptAuthStatus: { ...recovered, error: String(error) } });
  } finally { if (epoch === chatGptEpoch) set({ isConnectingSubscription: false }); }
}

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
      const savedAiConfig = { ...(parsed.aiConfig || {}) };
      // Reviewer system prompts are product-owned, not user preferences. Drop
      // the legacy editable field and retain a customized value as separate
      // supplemental instructions for global reviews.
      const legacySystemPrompt = savedAiConfig.systemPrompt;
      delete savedAiConfig.systemPrompt;
      if (typeof savedAiConfig.reviewerInstructions !== 'string') {
        savedAiConfig.reviewerInstructions = typeof legacySystemPrompt === 'string'
          && legacySystemPrompt.trim()
          && legacySystemPrompt !== LEGACY_DEFAULT_AI_SYSTEM_PROMPT
          ? legacySystemPrompt
          : '';
      }
      const loadedAiConfig: AiConfig = {
        ...DEFAULT_AI_CONFIG,
        ...savedAiConfig,
        apiKey: '', // Never trust or retain plaintext apiKey from localStorage
      };

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
          }));
        } catch {
          localStorage.removeItem(STORAGE_KEY);
        }

        if (isTauri()) {
          const providerToMigrate = loadedAiConfig.provider || DEFAULT_AI_CONFIG.provider;
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

      // Keep explicitly saved model choices. Preset defaults are for missing fields,
      // not a reason to silently replace a user's valid selection on each startup.
      const savedPreset = AI_PROVIDERS.find((provider) => provider.id === loadedAiConfig.provider);
      if (!parsed.aiConfig?.model) loadedAiConfig.model = savedPreset?.defaultModel || DEFAULT_AI_CONFIG.model;
      if (parsed.aiConfig?.baseUrl === undefined) loadedAiConfig.baseUrl = savedPreset?.defaultBaseUrl || DEFAULT_AI_CONFIG.baseUrl;

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
        mcpServers: mcpServers.map(resetMcpVerification),
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
  isCheckingApiKey: false,
  apiKeyCheckError: null,
  mcpServers: initialState.mcpServers,
  guardrailPolicy: initialState.guardrailPolicy,
  guardrailAuditLog: [],
  isGuardrailLoading: false,
  isTestingAi: false,
  aiTestResult: null,
  activeSubTab: 'ai',

  // Dynamic Live Models State
  dynamicModels: {},
  isFetchingDynamicModels: false,
  dynamicModelError: null,

  // Cloud Subscription & CLI Bridge State
  copilotStatus: null,
  googleAuthStatus: null,
  chatgptAuthStatus: null,
  cliStatus: {},
  isDetectingCli: false,
  isConnectingSubscription: false,
  isCheckingSubscription: false,
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

    const nextConfig: AiConfig = {
      ...get().aiConfig,
      provider: providerId,
      baseUrl: providerPreset.defaultBaseUrl,
      model: providerPreset.defaultModel,
      reasoningEffort: undefined,
      fastMode: false,
      apiKey: '',
    };
    set({ aiConfig: nextConfig, aiTestResult: null });
    persistState(nextConfig, get().mcpServers);

    // Selecting a provider never reads secrets or contacts a model endpoint.
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
            : aiConfig.provider === 'xai_grok'
            ? 'grok'
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
            authMode: aiConfig.authMode || 'api_key', model: aiConfig.model,
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
      } else {
        alert('GitHub Copilot authentication requires the Stage0 desktop app (Tauri) to store the session token in the OS keyring.');
        set({ isConnectingSubscription: false });
        return null;
      }
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
    if (get().isCheckingSubscription) return get().copilotStatus || { connected: false, has_subscription: false };
    set({ isCheckingSubscription: true });
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
    } finally { set({ isCheckingSubscription: false }); }
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
        await invoke('open_external_url', { url: res.auth_url }).catch(() => {});
        // The browser callback stores credentials. Do not poll the keyring;
        // the user can explicitly check the saved sign-in after returning.
      } else {
        alert('Google AI Studio OAuth sign-in requires the Stage0 desktop app (Tauri).');
      }
    } catch (e) {
      console.error('Failed to start Google OAuth:', e);
    } finally {
      set({ isConnectingSubscription: false });
    }
  },

  checkGoogleAuthStatus: async () => {
    if (get().isCheckingSubscription) return get().googleAuthStatus || { connected: false, auth_method: 'none' };
    set({ isCheckingSubscription: true });
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
    } finally { set({ isCheckingSubscription: false }); }
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

  startChatGptOAuth: (profileId) => chatGptAction('chatgpt_oauth_start', { profileId: profileId || null }, set, get),

  checkChatGptAuthStatus: async () => {
    const epoch = chatGptEpoch; const sequence = ++chatGptPoll;
    if (get().isConnectingSubscription) return get().chatgptAuthStatus || { connected: false };
    try {
      if (isTauri()) {
        const status = publicChatGptStatus(await invoke<ChatGptAuthStatus>('chatgpt_oauth_check_status'));
        if (epoch === chatGptEpoch && sequence === chatGptPoll && !get().isConnectingSubscription) set({ chatgptAuthStatus: status });
        return status;
      }
      const mock: ChatGptAuthStatus = { connected: false };
      return mock;
    } catch (e) {
      const errStatus: ChatGptAuthStatus = { connected: false, error: String(e) };
      if (epoch === chatGptEpoch && sequence === chatGptPoll) set({ chatgptAuthStatus: errStatus });
      return errStatus;
    }
  },

  loadSavedChatGptAuth: () => chatGptAction('chatgpt_oauth_load_saved', undefined, set, get),

  disconnectChatGptOAuth: (profileId) => chatGptAction('chatgpt_oauth_disconnect', { profileId }, set, get),
  refreshChatGptSession: (profileId) => chatGptAction('chatgpt_oauth_refresh', { profileId }, set, get),
  cancelChatGptOAuth: async () => {
    const attemptId = get().chatgptAuthStatus?.attempt_id;
    if (attemptId) await chatGptAction('chatgpt_oauth_cancel', { attemptId }, set, get);
  },

  clearCopilotDeviceCode: () => set({ copilotDeviceCode: null }),

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
    persistState(get().aiConfig, nextServers);
  },

  updateMcpServer: (id, updates) => {
    const nextServers = get().mcpServers.map((s) =>
      s.id === id ? resetMcpVerification({ ...s, ...updates }) : s
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
      s.id === id ? resetMcpVerification({ ...s, enabled: !s.enabled }) : s
    );
    set({ mcpServers: nextServers });
    persistState(get().aiConfig, nextServers);
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
    persistState(get().aiConfig, nextServers, get().guardrailPolicy);
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
      if (server.type !== 'stdio') {
        exportObj.mcpServers[server.name] = {
          type: server.type,
          url: server.url,
          env: Object.keys(server.env).length > 0 ? server.env : undefined,
        };
      } else {
        exportObj.mcpServers[server.name] = {
          type: 'stdio',
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
      // Rehydrate the last committed policy before reading native state. Reading
      // the fresh backend's balanced default first would erase saved preferences.
      void (async () => {
        try {
          await invoke('commit_ai_preferences', { apiKeys: {}, policy: initialState.guardrailPolicy });
          await useAiMcpStore.getState().loadGuardrailPolicy();
        } catch {
          console.warn('Could not restore the saved guardrail policy; saved preferences were retained.');
        }
      })();
      void useAiMcpStore.getState().loadGuardrailAuditLog();
      void useAiMcpStore.getState().detectCli('claude');
      void useAiMcpStore.getState().detectCli('gh_copilot');
    }
  }, 150);
}
