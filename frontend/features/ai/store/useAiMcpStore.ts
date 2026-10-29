import { getApplicationServices } from '../../../core/services/runtime/applicationRuntime';

import { create } from 'zustand';
import { loadPersistedState, normalizeLoadedAiConfig } from '../services/aiMcpPersistence';
import { type AiConfig } from '../types/AiConfig';
import type { AiMcpState } from '../types/AiMcpState';
import type { AcpAgentConfig } from '../types/AcpAgentConfig';
import { type GuardrailPolicy } from '../types/GuardrailPolicy';
import { DEFAULT_GUARDRAIL_POLICY } from '../types/guardrails';
import { type McpServerConfig } from '../types/McpServerConfig';
import { resetMcpVerification } from '../utils/resetMcpVerification';
import { DEFAULT_MCP_SERVERS } from '../constants/aiPresets';
import { createAiConfigSlice } from './slices/createAiConfigSlice';
import { createExternalAgentsSlice } from './slices/createExternalAgentsSlice';
import { createGuardrailsSlice } from './slices/createGuardrailsSlice';
import { createMcpServersSlice } from './slices/createMcpServersSlice';

const initialState = loadPersistedState();

export const useAiMcpStore = create<AiMcpState>((...args) => ({
  ...createMcpServersSlice(initialState)(...args),
  ...createGuardrailsSlice(initialState)(...args),
  ...createExternalAgentsSlice(initialState)(...args),
  ...createAiConfigSlice(initialState)(...args),
}));

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('stage0-preferences-updated', (event) => {
    const settings = (event as CustomEvent<Window['__STAGE0_PREFERENCES__']>).detail;
    const configured = settings?.ai ?? {};
    const aiConfig =
      configured.aiConfig && typeof configured.aiConfig === 'object'
        ? normalizeLoadedAiConfig(configured.aiConfig as Partial<AiConfig>)
        : normalizeLoadedAiConfig();
    const mcpServers = Array.isArray(configured.mcpServers)
      ? configured.mcpServers.map((server) => resetMcpVerification(server as McpServerConfig))
      : DEFAULT_MCP_SERVERS.map(resetMcpVerification);
    const guardrailPolicy =
      configured.guardrailPolicy && typeof configured.guardrailPolicy === 'object'
        ? {
            ...DEFAULT_GUARDRAIL_POLICY,
            ...(configured.guardrailPolicy as Partial<GuardrailPolicy>),
          }
        : DEFAULT_GUARDRAIL_POLICY;
    const externalAgents = Array.isArray(configured.externalAgents)
      ? configured.externalAgents as AcpAgentConfig[] : [];
    useAiMcpStore.setState({ aiConfig, mcpServers, guardrailPolicy, externalAgents, aiTestResult: null });
  });
}

// Safely defer background hydration to avoid blocking module evaluation on startup
if (typeof window !== 'undefined' && typeof window.setTimeout === 'function') {
  window.setTimeout(() => {
    if (getApplicationServices().platform.capabilities.keychain) {
      // Rehydrate the last committed policy before reading native state. Reading
      // the fresh backend's balanced default first would erase saved preferences.
      void (async () => {
        try {
          await getApplicationServices().aiProviders.commitAiPreferences({
            apiKeys: {},
            apiKeyRemovals: [],
            policy: initialState.guardrailPolicy,
            mcpEnvSecrets: {},
            mcpEnvRemovals: {},
          });
          await useAiMcpStore.getState().loadGuardrailPolicy();
        } catch {
          console.warn(
            'Could not restore the saved guardrail policy; saved preferences were retained.'
          );
        }
      })();
      void useAiMcpStore.getState().loadGuardrailAuditLog();
    }
  }, 150);
}
