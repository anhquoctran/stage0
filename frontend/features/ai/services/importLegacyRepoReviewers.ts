import { commitRepositorySettings } from '../../virtual-mr/services/repositorySettingsDocuments';
import { loadPersistedRepoActiveBots, loadPersistedRepoCustomBots, persistRepoActiveBots, persistRepoCustomBots } from './botReviewerPersistence';
import { portableReviewer } from './repoReviewerConsent';

export function hasLegacyRepoReviewers(repoId: string) {
  return !!loadPersistedRepoCustomBots()[repoId]?.length || loadPersistedRepoActiveBots()[repoId] !== undefined;
}

export async function importLegacyRepoReviewers(repoId: string) {
  const bots = loadPersistedRepoCustomBots();
  const active = loadPersistedRepoActiveBots();
  await commitRepositorySettings(repoId, (current) => ({
    customReviewers: [...current.customReviewers, ...(bots[repoId] ?? [])
      .filter((bot) => !current.customReviewers.some((item) => item.id === bot.id)).map(portableReviewer)],
    activeAgentIds: current.activeAgentIds ?? active[repoId] ?? null,
  }));
  // Keep the legacy copy on any failure; discard only after acknowledged commit.
  delete bots[repoId]; delete active[repoId];
  persistRepoCustomBots(bots); persistRepoActiveBots(active);
}
