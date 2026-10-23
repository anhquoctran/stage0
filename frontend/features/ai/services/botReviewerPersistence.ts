import { preferencesJsonService } from '../../preferences/services/preferencesJsonService';
import { type BotReviewer } from '../../virtual-mr/types/BotReviewer';
import { DEFAULT_BOT_REVIEWERS } from '../constants/botPresets';
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
const BOT_ROLE_IDS = new Set([
  'security',
  'performance',
  'architecture',
  'style',
  'test',
  'documentation',
  'custom',
]);

function normalizeReviewer(value: unknown): BotReviewer | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const persisted = { ...(value as Record<string, unknown>) };
  if (typeof persisted.id !== 'string' || typeof persisted.name !== 'string') return null;
  if (typeof persisted.category !== 'string' || !BOT_ROLE_IDS.has(persisted.category)) {
    persisted.category = 'custom';
  }

  const legacyPrompt = persisted.systemPrompt;
  const customInstructions =
    typeof persisted.customInstructions === 'string'
      ? persisted.customInstructions
      : typeof legacyPrompt === 'string'
        ? legacyPrompt
        : '';
  delete persisted.systemPrompt;

  if (typeof persisted.acpAgentId !== 'string') delete persisted.acpAgentId;
  if (typeof persisted.allowAcpSourceTransfer !== 'boolean')
    delete persisted.allowAcpSourceTransfer;

  return { ...persisted, customInstructions } as unknown as BotReviewer;
}

export function normalizeReviewerList(values: unknown[]): {
  reviewers: BotReviewer[];
  changed: boolean;
} {
  const reviewers: BotReviewer[] = [];
  let changed = false;
  for (const value of values) {
    const reviewer = normalizeReviewer(value);
    if (!reviewer) {
      changed = true;
      continue;
    }
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      'systemPrompt' in value ||
      typeof (value as Record<string, unknown>).customInstructions !== 'string' ||
      typeof (value as Record<string, unknown>).category !== 'string' ||
      !BOT_ROLE_IDS.has((value as Record<string, unknown>).category as string)
    )
      changed = true;
    reviewers.push(reviewer);
  }
  return { reviewers, changed };
}

export function loadPersistedGlobalReviewers(): BotReviewer[] {
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
        if (filtered.length !== parsed.length || normalized.changed)
          persistGlobalReviewers(normalized.reviewers);
        return normalized.reviewers;
      }
    }
  } catch (err) {
    console.warn('Failed to parse global bot reviewers:', err);
  }
  return DEFAULT_BOT_REVIEWERS;
}

export function loadPersistedRepoActiveBots(): Record<string, string[]> {
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

export function loadPersistedRepoCustomBots(): Record<string, BotReviewer[]> {
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

export function persistGlobalReviewers(reviewers: BotReviewer[]) {
  void preferencesJsonService
    .patch({ reviewers })
    .catch((error) => console.error('Could not save preferences.json:', error));
}

export function persistRepoActiveBots(data: Record<string, string[]>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(REPO_ACTIVE_STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Failed to save repo active bots:', err);
  }
}

export function persistRepoCustomBots(data: Record<string, BotReviewer[]>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(REPO_CUSTOM_STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Failed to save repo custom bots:', err);
  }
}
