import { invoke, isTauri } from '../../../../common/services/ipc/ipcClient';
import type { StateCreator } from 'zustand';
import { loadPersistedState, persistState } from '../../services/aiMcpPersistence';
import type { AiMcpState } from '../../types/AiMcpState';
import { type GuardrailAuditEvent } from '../../types/GuardrailAuditEvent';
import { type GuardrailEvaluationResult } from '../../types/GuardrailEvaluationResult';
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
          const resetPolicy = await invoke<GuardrailPolicy>('reset_guardrail_policy', {
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
      if (!isTauri()) return;
      try {
        const logs = await invoke<GuardrailAuditEvent[]>('get_guardrail_audit_log', {
          limit,
        });
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
  });
