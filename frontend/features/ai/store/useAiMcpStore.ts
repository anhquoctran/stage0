import { invoke, isTauri } from '@tauri-apps/api/core';
import { create } from 'zustand';
import { loadPersistedState, normalizeLoadedAiConfig } from '../services/aiMcpPersistence';
import { type AiConfig } from '../types/AiConfig';
import type { AiMcpState } from '../types/AiMcpState';
import { type GuardrailPolicy } from '../types/GuardrailPolicy';
import { DEFAULT_GUARDRAIL_POLICY } from '../types/guardrails';
import { type McpServerConfig } from '../types/McpServerConfig';
import { resetMcpVerification } from '../utils/resetMcpVerification';
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
    const configured = settings?.ai;
    if (!configured || Object.keys(configured).length === 0) return;
    const aiConfig =
      configured.aiConfig && typeof configured.aiConfig === 'object'
        ? normalizeLoadedAiConfig(configured.aiConfig as Partial<AiConfig>)
        : useAiMcpStore.getState().aiConfig;
    const mcpServers = Array.isArray(configured.mcpServers)
      ? configured.mcpServers.map((server) => resetMcpVerification(server as McpServerConfig))
      : useAiMcpStore.getState().mcpServers;
    const guardrailPolicy =
      configured.guardrailPolicy && typeof configured.guardrailPolicy === 'object'
        ? {
            ...DEFAULT_GUARDRAIL_POLICY,
            ...(configured.guardrailPolicy as Partial<GuardrailPolicy>),
          }
        : useAiMcpStore.getState().guardrailPolicy;
    useAiMcpStore.setState({ aiConfig, mcpServers, guardrailPolicy, aiTestResult: null });
  });
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
          console.warn(
            'Could not restore the saved guardrail policy; saved preferences were retained.'
          );
        }
      })();
      void useAiMcpStore.getState().loadGuardrailAuditLog();
    }
  }, 150);
}
