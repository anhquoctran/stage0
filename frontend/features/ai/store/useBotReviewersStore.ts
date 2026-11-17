import { createRepoReviewerActions } from './createRepoReviewerActions';
import { subscribeRepositorySettings } from '../../virtual-mr/services/repositorySettingsDocuments';
import { withRepoReviewerConsent } from '../services/repoReviewerConsent';
import { create } from 'zustand';
import { type BotReviewer } from '../../virtual-mr/types/BotReviewer';
import { DEFAULT_BOT_REVIEWERS } from '../constants/botPresets';
import {
  loadPersistedGlobalReviewers,
  normalizeReviewerList,
  persistGlobalReviewers,
} from '../services/botReviewerPersistence';
import type { BotReviewersState } from '../types/BotReviewersState';

export const useBotReviewersStore = create<BotReviewersState>((set, get) => ({
  globalReviewers: loadPersistedGlobalReviewers(),
  repoActiveBotIds: {},
  repoCustomReviewers: {},

  reloadPersistedReviewers: () =>
    set({
      globalReviewers: loadPersistedGlobalReviewers(),
    }),

  addGlobalReviewer: (bot) => {
    const newId = `custom-bot-${Date.now()}`;
    const newBot: BotReviewer = {
      ...bot,
      id: newId,
      isBuiltin: false,
    };
    const updated = [...get().globalReviewers, newBot];
    set({ globalReviewers: updated });
    persistGlobalReviewers(updated);
    return newId;
  },

  updateGlobalReviewer: (id, updates) => {
    const updated = get().globalReviewers.map((b) => (b.id === id ? { ...b, ...updates } : b));
    set({ globalReviewers: updated });
    persistGlobalReviewers(updated);
  },

  deleteGlobalReviewer: (id) => {
    const updated = get().globalReviewers.filter((b) => b.id !== id);
    set({ globalReviewers: updated });
    persistGlobalReviewers(updated);
  },

  toggleGlobalReviewer: (id) => {
    const updated = get().globalReviewers.map((b) =>
      b.id === id ? { ...b, enabled: !b.enabled } : b
    );
    set({ globalReviewers: updated });
    persistGlobalReviewers(updated);
  },

  resetGlobalReviewers: () => {
    set({ globalReviewers: DEFAULT_BOT_REVIEWERS });
    persistGlobalReviewers(DEFAULT_BOT_REVIEWERS);
  },

  ...createRepoReviewerActions(set, get),

  getEffectiveReviewers: (repoId, inheritGlobalAgents = true) => {
    const { globalReviewers, repoActiveBotIds, repoCustomReviewers } = get();

    // 1. If inheriting from global (default), return all enabled global reviewers
    if (inheritGlobalAgents || !repoId) {
      const active = globalReviewers.filter((b) => b.enabled);
      return {
        reviewers: active,
        allConfigured: globalReviewers,
        isInherited: true,
      };
    }

    // 2. Custom Repo Scope
    const customRepoBots = repoCustomReviewers[repoId] || [];
    const allAvailable = [...globalReviewers, ...customRepoBots];
    const activeIds = repoActiveBotIds[repoId];

    // If repo hasn't explicitly chosen yet, fallback to all enabled global bots + custom repo bots
    if (!activeIds) {
      const active = allAvailable.filter((b) => b.enabled);
      return {
        reviewers: active,
        allConfigured: allAvailable,
        isInherited: false,
      };
    }

    const activeSet = new Set(activeIds);
    const active = allAvailable.filter((b) => activeSet.has(b.id));

    return {
      reviewers: active,
      allConfigured: allAvailable,
      isInherited: false,
    };
  },
}));

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('stage0-preferences-updated', (event) => {
    const settings = (event as CustomEvent<Window['__STAGE0_PREFERENCES__']>).detail;
    useBotReviewersStore.setState({
      globalReviewers: normalizeReviewerList(Array.isArray(settings?.reviewers) ? settings.reviewers : DEFAULT_BOT_REVIEWERS).reviewers,
    });
  });
}

subscribeRepositorySettings((repoId, doc) => {
  const state = useBotReviewersStore.getState();
  const selected = { ...state.repoActiveBotIds };
  if (doc.settings.activeAgentIds === null) delete selected[repoId];
  else selected[repoId] = doc.settings.activeAgentIds;
  useBotReviewersStore.setState({ repoActiveBotIds: selected,
    repoCustomReviewers: { ...state.repoCustomReviewers,
      [repoId]: doc.settings.customReviewers.map((bot) => withRepoReviewerConsent(repoId, bot)) },
  });
});
