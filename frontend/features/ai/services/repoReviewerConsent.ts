import type { BotReviewer } from '../../virtual-mr/types/BotReviewer';

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.entries(value).filter(([, value]) => value !== undefined).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => [key, stable(child)]),
  );
  return value;
}

function descriptor(bot: BotReviewer) {
  const { allowAcpSourceTransfer: _consent, ...config } = bot;
  return JSON.stringify(stable(config));
}
const key = (repoId: string, botId: string) => `stage0_repo_acp_consent:${repoId}:${botId}`;

export function saveRepoReviewerConsent(repoId: string, bot: BotReviewer) {
  if (bot.allowAcpSourceTransfer && bot.acpAgentId) localStorage.setItem(key(repoId, bot.id), descriptor(bot));
  else localStorage.removeItem(key(repoId, bot.id));
}

export function withRepoReviewerConsent(repoId: string, bot: BotReviewer): BotReviewer {
  let allowed = false;
  try { allowed = !!bot.acpAgentId && localStorage.getItem(key(repoId, bot.id)) === descriptor(bot); } catch { /* No consent. */ }
  return { ...bot, allowAcpSourceTransfer: allowed };
}

export function portableReviewer(bot: BotReviewer) {
  const { allowAcpSourceTransfer: _consent, ...config } = bot;
  return config;
}
