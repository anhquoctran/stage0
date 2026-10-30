import { getApplicationServices } from '../../../../core/services/runtime/applicationRuntime';

import type { StateCreator } from 'zustand';
import { loadPersistedState, persistState } from '../../services/aiMcpPersistence';
import type { AiMcpState } from '../../types/AiMcpState';
import { type GuardrailPolicy } from '../../types/GuardrailPolicy';
import { DEFAULT_GUARDRAIL_POLICY } from '../../types/guardrails';

export const createGuardrailsSlice =
  (
    initialState: ReturnType<typeof loadPersistedState>
  ): StateCreator<
    AiMcpState,
    [],
    [],
    Pick<
      AiMcpState,
      | 'guardrailPolicy'
      | 'guardrailAuditLog'
      | 'isGuardrailLoading'
      | 'loadGuardrailPolicy'
      | 'updateGuardrailPolicy'
      | 'resetGuardrailPolicy'
      | 'loadGuardrailAuditLog'
      | 'clearGuardrailAuditLog'
      | 'simulateGuardrailCheck'
    >
  > =>
  (set, get) => ({
    guardrailPolicy: initialState.guardrailPolicy,

    guardrailAuditLog: [],

    isGuardrailLoading: false,

    loadGuardrailPolicy: async () => {
      if (!getApplicationServices().platform.capabilities.keychain) return;
      try {
        set({ isGuardrailLoading: true });
        const backendPolicy = await getApplicationServices().guardrails.getGuardrailPolicy();
        if (backendPolicy) {
          set({ guardrailPolicy: backendPolicy });
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
      if (getApplicationServices().platform.capabilities.keychain) {
        try {
          await getApplicationServices().guardrails.updateGuardrailPolicy({ policy: nextPolicy });
        } catch (err) {
          console.error('Failed to sync guardrail policy to backend:', err);
        }
      }
    },

    resetGuardrailPolicy: async (mode) => {
      if (getApplicationServices().platform.capabilities.keychain) {
        try {
          const resetPolicy = await getApplicationServices().guardrails.resetGuardrailPolicy({
            mode,
          });
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
      if (!getApplicationServices().platform.capabilities.keychain) return;
      try {
        const logs = await getApplicationServices().guardrails.getGuardrailAuditLog({
          limit,
        });
        set({ guardrailAuditLog: logs || [] });
      } catch (err) {
        console.warn('Failed to load guardrail audit log:', err);
      }
    },

    clearGuardrailAuditLog: async () => {
      if (getApplicationServices().platform.capabilities.keychain) {
        try {
          await getApplicationServices().guardrails.clearGuardrailAuditLog();
        } catch (err) {
          console.warn('Failed to clear audit log:', err);
        }
      }
      set({ guardrailAuditLog: [] });
    },

    simulateGuardrailCheck: async (toolName, args) => {
      if (getApplicationServices().platform.capabilities.keychain) {
        try {
          const res = await getApplicationServices().guardrails.simulateGuardrailCheck({
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
  });
