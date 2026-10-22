import { invoke, isTauri } from '@tauri-apps/api/core';
import { preferencesJsonService } from '../../preferences/services/preferencesJsonService';
import { AI_PROVIDERS, DEFAULT_AI_CONFIG, DEFAULT_MCP_SERVERS } from '../constants/aiPresets';
import type { AcpAgentConfig } from '../types/AcpAgentConfig';
import { type AiConfig } from '../types/AiConfig';
import { type GuardrailPolicy } from '../types/GuardrailPolicy';
import { DEFAULT_GUARDRAIL_POLICY } from '../types/guardrails';
import { type McpServerConfig } from '../types/McpServerConfig';
import { configuredProviderIds } from '../utils/aiProviderSettings';
import { listSecretMcpEnv } from '../utils/listSecretMcpEnv';
import { resetMcpVerification } from '../utils/resetMcpVerification';

const STORAGE_KEY = 'stage0_ai_mcp_config';
const LEGACY_DEFAULT_AI_SYSTEM_PROMPT = `You are an expert software engineer and code reviewer embedded in Stage0 Git Reviewer.
When reviewing git diffs:
1. Identify logic flaws, subtle edge cases, concurrency hazards, and security issues.
2. Recommend idiomatic, performant patterns conforming to the language standard.
3. Be clear, constructive, and concise. Avoid superfluous praise.
4. Format markdown with code blocks, line references, and actionable improvements.`;

export function normalizeLoadedAiConfig(saved?: Partial<AiConfig>): AiConfig {
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
export function loadPersistedState(): {
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
    const raw =
      bootstrap !== undefined
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
      if (
        typeof savedAiConfig.reviewerInstructions !== 'string' ||
        !savedAiConfig.reviewerInstructions.trim()
      ) {
        if (
          typeof legacySystemPrompt === 'string' &&
          legacySystemPrompt.trim() &&
          legacySystemPrompt !== LEGACY_DEFAULT_AI_SYSTEM_PROMPT
        ) {
          savedAiConfig.reviewerInstructions = legacySystemPrompt;
        }
      }
      const loadedAiConfig = normalizeLoadedAiConfig(savedAiConfig);

      const loadedGuardrailPolicy: GuardrailPolicy = {
        ...DEFAULT_GUARDRAIL_POLICY,
        ...(parsed.guardrailPolicy || {}),
      };

      const loadedMcpServers = (
        Array.isArray(parsed.mcpServers) ? parsed.mcpServers : DEFAULT_MCP_SERVERS
      ).map(resetMcpVerification);
      // Erase legacy plaintext before starting asynchronous keychain I/O. If
      // the OS keychain is unavailable, the user must re-enter the key rather
      // than silently leaving a plaintext credential behind.
      if (typeof legacyKey === 'string' && legacyKey.trim().length > 0) {
        try {
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
              aiConfig: loadedAiConfig,
              mcpServers: loadedMcpServers,
              guardrailPolicy: loadedGuardrailPolicy,
              externalAgents: Array.isArray(parsed.externalAgents) ? parsed.externalAgents : [],
            })
          );
        } catch {
          localStorage.removeItem(STORAGE_KEY);
        }

        const legacyKeyProvider =
          typeof savedAiConfig.provider === 'string' &&
          AI_PROVIDERS.some((provider) => provider.id === savedAiConfig.provider)
            ? (savedAiConfig.provider as AiConfig['provider'])
            : savedAiConfig.provider === undefined
              ? DEFAULT_AI_CONFIG.provider
              : null;
        if (isTauri() && legacyKeyProvider) {
          void invoke('store_ai_api_key', {
            provider: legacyKeyProvider,
            apiKey: legacyKey.trim(),
          }).catch(() => {
            console.warn(
              'A previously saved API key could not be moved to the OS credential store. Please enter it again.'
            );
          });
        } else {
          console.warn(
            'A legacy plaintext API key was removed from browser storage. Please enter it again in the desktop app.'
          );
        }
      }

      // Keep explicitly saved model choices. Preset defaults are for missing fields,
      // not a reason to silently replace a user's valid selection on each startup.
      const savedPreset = AI_PROVIDERS.find((provider) => provider.id === loadedAiConfig.provider);
      if (!parsed.aiConfig?.model)
        loadedAiConfig.model = savedPreset?.defaultModel || DEFAULT_AI_CONFIG.model;
      if (parsed.aiConfig?.baseUrl === undefined)
        loadedAiConfig.baseUrl = savedPreset?.defaultBaseUrl || DEFAULT_AI_CONFIG.baseUrl;

      return {
        aiConfig: loadedAiConfig,
        mcpServers: loadedMcpServers,
        guardrailPolicy: loadedGuardrailPolicy,
        externalAgents: Array.isArray(parsed.externalAgents)
          ? parsed.externalAgents.filter(
              (agent: AcpAgentConfig) =>
                agent &&
                typeof agent.id === 'string' &&
                typeof agent.name === 'string' &&
                typeof agent.command === 'string' &&
                Array.isArray(agent.args)
            )
          : [],
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

export function persistState(
  aiConfig: AiConfig,
  mcpServers: McpServerConfig[],
  guardrailPolicy?: GuardrailPolicy,
  externalAgents: AcpAgentConfig[] = []
) {
  if (typeof window === 'undefined') return;
  if (listSecretMcpEnv(mcpServers).length) {
    console.warn(
      'MCP preferences were not saved because secret environment variables must be moved to the OS keychain first.'
    );
    return;
  }
  const sanitizedAiConfig = { ...aiConfig } as Partial<AiConfig>;
  delete sanitizedAiConfig.apiKey;
  const persistedAiConfig = sanitizedAiConfig as Record<string, unknown>;
  persistedAiConfig.authMode = { $stage0Delete: true };
  persistedAiConfig.cliType = { $stage0Delete: true };
  const persistedServers = mcpServers.map((server) => {
    const clean = resetMcpVerification(server);
    const env = Object.fromEntries(
      Object.entries(clean.env ?? {}).filter(
        ([key, value]) =>
          !/(token|secret|password|credential|api[_-]?key)/i.test(key) &&
          !/^(sk-|ghp_|github_pat_|glpat-|xox[bp]-)/i.test(value.trim())
      )
    );
    return { ...clean, env };
  });
  void preferencesJsonService
    .patch({
      ai: {
        aiConfig: persistedAiConfig,
        mcpServers: persistedServers,
        guardrailPolicy: guardrailPolicy || DEFAULT_GUARDRAIL_POLICY,
        externalAgents,
      },
    })
    .catch((error) => console.error('Could not save preferences.json:', error));
}
