import { create } from 'zustand';
import { type BotReviewer } from '../../virtual-mr/types/BotReviewer';
import { DEFAULT_BOT_REVIEWERS } from '../constants/botPresets';
import {
  loadPersistedGlobalReviewers,
  loadPersistedRepoActiveBots,
  loadPersistedRepoCustomBots,
  normalizeReviewerList,
  persistGlobalReviewers,
  persistRepoActiveBots,
  persistRepoCustomBots,
} from '../services/botReviewerPersistence';
import type { BotReviewersState } from '../types/BotReviewersState';

export const useBotReviewersStore = create<BotReviewersState>((set, get) => ({
  globalReviewers: loadPersistedGlobalReviewers(),
  repoActiveBotIds: loadPersistedRepoActiveBots(),
  repoCustomReviewers: loadPersistedRepoCustomBots(),

  reloadPersistedReviewers: () =>
    set({
      globalReviewers: loadPersistedGlobalReviewers(),
      repoActiveBotIds: loadPersistedRepoActiveBots(),
      repoCustomReviewers: loadPersistedRepoCustomBots(),
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

  setRepoActiveBotIds: (repoId, botIds) => {
    const current = { ...get().repoActiveBotIds, [repoId]: botIds };
    set({ repoActiveBotIds: current });
    persistRepoActiveBots(current);
  },

  toggleRepoActiveBotId: (repoId, botId) => {
    const activeMap = get().repoActiveBotIds;
    const globalList = get().globalReviewers;
    // Default to all enabled global bots if not yet customized
    const currentList = activeMap[repoId] ?? globalList.filter((b) => b.enabled).map((b) => b.id);
    const exists = currentList.includes(botId);
    const updatedList = exists ? currentList.filter((id) => id !== botId) : [...currentList, botId];

    const current = { ...activeMap, [repoId]: updatedList };
    set({ repoActiveBotIds: current });
    persistRepoActiveBots(current);
  },

  addRepoCustomReviewer: (repoId, bot) => {
    const newId = `repo-${repoId}-bot-${Date.now()}`;
    const newBot: BotReviewer = {
      ...bot,
      id: newId,
      isBuiltin: false,
    };
    const currentMap = get().repoCustomReviewers;
    const repoBots = currentMap[repoId] || [];
    const updated = { ...currentMap, [repoId]: [...repoBots, newBot] };
    set({ repoCustomReviewers: updated });
    persistRepoCustomBots(updated);

    // Also activate it for this repo
    const activeMap = get().repoActiveBotIds;
    const activeList = activeMap[repoId] || [];
    if (!activeList.includes(newId)) {
      get().setRepoActiveBotIds(repoId, [...activeList, newId]);
    }

    return newId;
  },

  updateRepoCustomReviewer: (repoId, botId, updates) => {
    const currentMap = get().repoCustomReviewers;
    const repoBots = currentMap[repoId] || [];
    const updated = {
      ...currentMap,
      [repoId]: repoBots.map((b) => (b.id === botId ? { ...b, ...updates } : b)),
    };
    set({ repoCustomReviewers: updated });
    persistRepoCustomBots(updated);
  },

  deleteRepoCustomReviewer: (repoId, botId) => {
    const currentMap = get().repoCustomReviewers;
    const repoBots = currentMap[repoId] || [];
    const updated = {
      ...currentMap,
      [repoId]: repoBots.filter((b) => b.id !== botId),
    };
    set({ repoCustomReviewers: updated });
    persistRepoCustomBots(updated);

    // Also remove from active list if present
    const activeMap = get().repoActiveBotIds;
    if (activeMap[repoId]) {
      get().setRepoActiveBotIds(
        repoId,
        activeMap[repoId].filter((id) => id !== botId)
      );
    }
  },

  resetRepoToGlobal: (repoId) => {
    const activeMap = { ...get().repoActiveBotIds };
    delete activeMap[repoId];
    set({ repoActiveBotIds: activeMap });
    persistRepoActiveBots(activeMap);
  },

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
