import { create } from 'zustand';
import { type BotReviewer } from '../../virtual-mr/types/BotReviewer';
import { DEFAULT_BOT_REVIEWERS } from '../constants/botPresets';
import type { BotReviewersState } from '../types/BotReviewersState';
import { preferencesJsonService } from '../../preferences/services/preferencesJsonService';

const GLOBAL_STORAGE_KEY = 'stage0_global_bot_reviewers';

const REPO_ACTIVE_STORAGE_KEY = 'stage0_repo_active_bots';

const REPO_CUSTOM_STORAGE_KEY = 'stage0_repo_custom_bots';

const LEGACY_MOCK_IDS = new Set([
  'security-sentinel',
  'performance-optimizer',
  'architecture-sentinel',
  'bug-hunter',
  'documentation-spec',
]);
const BOT_ROLE_IDS = new Set(['security', 'performance', 'architecture', 'style', 'test', 'documentation', 'custom']);

function normalizeReviewer(value: unknown): BotReviewer | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const persisted = { ...(value as Record<string, unknown>) };
  if (typeof persisted.id !== 'string' || typeof persisted.name !== 'string') return null;
  if (typeof persisted.category !== 'string' || !BOT_ROLE_IDS.has(persisted.category)) {
    persisted.category = 'custom';
  }

  const legacyPrompt = persisted.systemPrompt;
  const customInstructions = typeof persisted.customInstructions === 'string'
    ? persisted.customInstructions
    : typeof legacyPrompt === 'string'
      ? legacyPrompt
      : '';
  delete persisted.systemPrompt;

  return { ...persisted, customInstructions } as unknown as BotReviewer;
}

function normalizeReviewerList(values: unknown[]): { reviewers: BotReviewer[]; changed: boolean } {
  const reviewers: BotReviewer[] = [];
  let changed = false;
  for (const value of values) {
    const reviewer = normalizeReviewer(value);
    if (!reviewer) {
      changed = true;
      continue;
    }
    if (
      !value || typeof value !== 'object' || Array.isArray(value) ||
      'systemPrompt' in value || typeof (value as Record<string, unknown>).customInstructions !== 'string' ||
      typeof (value as Record<string, unknown>).category !== 'string' ||
      !BOT_ROLE_IDS.has((value as Record<string, unknown>).category as string)
    ) changed = true;
    reviewers.push(reviewer);
  }
  return { reviewers, changed };
}

function loadPersistedGlobalReviewers(): BotReviewer[] {
  if (typeof window === 'undefined') return DEFAULT_BOT_REVIEWERS;
  const configured = window.__STAGE0_PREFERENCES__?.reviewers;
  if (Array.isArray(configured)) {
    const normalized = normalizeReviewerList(configured);
    return normalized.reviewers;
  }
  try {
    const raw = localStorage.getItem(GLOBAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter(
          (b: BotReviewer) => !LEGACY_MOCK_IDS.has(b.id) && !b.isBuiltin
        );
        const normalized = normalizeReviewerList(filtered);
        if (filtered.length !== parsed.length || normalized.changed) persistGlobalReviewers(normalized.reviewers);
        return normalized.reviewers;
      }
    }
  } catch (err) {
    console.warn('Failed to parse global bot reviewers:', err);
  }
  return DEFAULT_BOT_REVIEWERS;
}

function loadPersistedRepoActiveBots(): Record<string, string[]> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(REPO_ACTIVE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      let changed = false;
      const cleaned: Record<string, string[]> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (Array.isArray(v)) {
          cleaned[k] = v.filter((id) => !LEGACY_MOCK_IDS.has(id));
          if (cleaned[k].length !== v.length) changed = true;
        }
      }
      if (changed) persistRepoActiveBots(cleaned);
      return cleaned;
    }
  } catch {}
  return {};
}

function loadPersistedRepoCustomBots(): Record<string, BotReviewer[]> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(REPO_CUSTOM_STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      const normalized: Record<string, BotReviewer[]> = {};
      let changed = false;
      for (const [repoId, values] of Object.entries(parsed)) {
        if (!Array.isArray(values)) {
          changed = true;
          continue;
        }
        const list = normalizeReviewerList(values);
        normalized[repoId] = list.reviewers;
        if (list.changed) changed = true;
      }
      if (changed) persistRepoCustomBots(normalized);
      return normalized;
    }
  } catch {}
  return {};
}

function persistGlobalReviewers(reviewers: BotReviewer[]) {
  void preferencesJsonService.patch({ reviewers }).catch((error) => console.error('Could not save preferences.json:', error));
}

function persistRepoActiveBots(data: Record<string, string[]>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(REPO_ACTIVE_STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Failed to save repo active bots:', err);
  }
}

function persistRepoCustomBots(data: Record<string, BotReviewer[]>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(REPO_CUSTOM_STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Failed to save repo custom bots:', err);
  }
}

export const useBotReviewersStore = create<BotReviewersState>((set, get) => ({
  globalReviewers: loadPersistedGlobalReviewers(),
  repoActiveBotIds: loadPersistedRepoActiveBots(),
  repoCustomReviewers: loadPersistedRepoCustomBots(),

  reloadPersistedReviewers: () => set({
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
    const updated = get().globalReviewers.map((b) =>
      b.id === id ? { ...b, ...updates } : b
    );
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
    const updatedList = exists
      ? currentList.filter((id) => id !== botId)
      : [...currentList, botId];

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
    if (Array.isArray(settings?.reviewers)) {
      useBotReviewersStore.setState({ globalReviewers: normalizeReviewerList(settings.reviewers).reviewers });
    }
  });
}
