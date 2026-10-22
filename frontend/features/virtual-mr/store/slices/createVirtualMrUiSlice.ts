import type { StateCreator } from 'zustand';
import type { VirtualMrState } from '../../types/VirtualMrState';

export const createVirtualMrUiSlice: StateCreator<
  VirtualMrState,
  [],
  [],
  Pick<
    VirtualMrState,
    | 'isRepoSettingsOpen'
    | 'repoSettingsActiveTab'
    | 'openRepoSettings'
    | 'closeRepoSettings'
    | 'setRepoSettingsActiveTab'
    | 'sessions'
    | 'activeSessionId'
    | 'pendingDescriptionEditSessionId'
    | 'closedSessionTabIds'
    | 'isLoadingSessions'
    | 'isMrListOpen'
    | 'setIsMrListOpen'
    | 'activeMrTab'
    | 'setActiveMrTab'
    | 'draftMr'
    | 'isDraftActive'
    | 'getActiveSession'
    | 'consumeDescriptionEditRequest'
  >
> = (set, get) => ({
  isRepoSettingsOpen: false,

  repoSettingsActiveTab: 'remotes',

  openRepoSettings: (tab = 'remotes') =>
    set({ isRepoSettingsOpen: true, repoSettingsActiveTab: tab }),

  closeRepoSettings: () => set({ isRepoSettingsOpen: false }),

  setRepoSettingsActiveTab: (tab) => set({ repoSettingsActiveTab: tab }),

  sessions: [],

  activeSessionId: null,

  pendingDescriptionEditSessionId: null,

  closedSessionTabIds: [],

  isLoadingSessions: false,

  isMrListOpen: false,

  setIsMrListOpen: (isMrListOpen) => set({ isMrListOpen }),

  activeMrTab: 'overview',

  setActiveMrTab: (tab) => set({ activeMrTab: tab }),

  draftMr: null,

  isDraftActive: false,

  getActiveSession: () => {
    const { sessions, activeSessionId } = get();
    return sessions.find((s) => s.id === activeSessionId) || null;
  },

  consumeDescriptionEditRequest: (sessionId) => {
    const current = get().pendingDescriptionEditSessionId;
    if (current !== sessionId) return false;
    set({ pendingDescriptionEditSessionId: null });
    return true;
  },
});
