import type { StateCreator } from 'zustand';
import { loadPersistedState, persistState } from '../../services/aiMcpPersistence';
import type { AiMcpState } from '../../types/AiMcpState';

export const createExternalAgentsSlice =
  (
    initialState: ReturnType<typeof loadPersistedState>
  ): StateCreator<
    AiMcpState,
    [],
    [],
    Pick<AiMcpState, 'externalAgents' | 'updateExternalAgents'>
  > =>
  (set, get) => ({
    externalAgents: initialState.externalAgents,

    updateExternalAgents: (agents) => {
      set({ externalAgents: agents });
      persistState(get().aiConfig, get().mcpServers, get().guardrailPolicy, agents);
    },
  });
