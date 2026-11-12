import { commitRepositorySettings } from '../../virtual-mr/services/repositorySettingsDocuments';
import type { BotReviewersState } from '../types/BotReviewersState';
import { portableReviewer, saveRepoReviewerConsent, withRepoReviewerConsent } from '../services/repoReviewerConsent';

export function createRepoReviewerActions(
  set: (state: Partial<BotReviewersState>) => void,
  get: () => BotReviewersState,
): Pick<BotReviewersState, 'setRepoActiveBotIds' | 'toggleRepoActiveBotId' | 'addRepoCustomReviewer'
  | 'updateRepoCustomReviewer' | 'deleteRepoCustomReviewer' | 'resetRepoToGlobal'> {
  return {
    setRepoActiveBotIds: async (repoId, botIds) => {
      await commitRepositorySettings(repoId, () => ({ activeAgentIds: botIds }));
    },
    toggleRepoActiveBotId: async (repoId, botId) => {
      await commitRepositorySettings(repoId, (current) => {
        const selected = current.activeAgentIds ?? [...get().globalReviewers, ...current.customReviewers]
          .filter((bot) => bot.enabled).map((bot) => bot.id);
        return { activeAgentIds: selected.includes(botId) ? selected.filter((id) => id !== botId) : [...selected, botId] };
      });
    },
    addRepoCustomReviewer: async (repoId, bot) => {
      const id = `repo-bot-${crypto.randomUUID()}`;
      const configured = { ...bot, id, isBuiltin: false };
      const saved = await commitRepositorySettings(repoId, (current) => ({
        customReviewers: [...current.customReviewers, portableReviewer(configured)],
        activeAgentIds: [...new Set([...(current.activeAgentIds ?? get().globalReviewers.filter((b) => b.enabled).map((b) => b.id)), id])],
      }));
      saveRepoReviewerConsent(repoId, configured);
      set({ repoCustomReviewers: { ...get().repoCustomReviewers,
        [repoId]: saved.settings.customReviewers.map((b) => withRepoReviewerConsent(repoId, b)) } });
      return id;
    },
    updateRepoCustomReviewer: async (repoId, botId, updates) => {
      const before = get().repoCustomReviewers[repoId]?.find((bot) => bot.id === botId);
      if (!before) throw new Error('Reviewer no longer exists');
      const bot = { ...before, ...updates, id: botId, isBuiltin: false };
      const saved = await commitRepositorySettings(repoId, (current) => ({
        customReviewers: current.customReviewers.map((item) => item.id === botId ? portableReviewer(bot) : item),
      }));
      // A change of ACP configuration requires fresh explicit consent.
      saveRepoReviewerConsent(repoId, { ...bot, allowAcpSourceTransfer: updates.allowAcpSourceTransfer === true });
      set({ repoCustomReviewers: { ...get().repoCustomReviewers,
        [repoId]: saved.settings.customReviewers.map((b) => withRepoReviewerConsent(repoId, b)) } });
    },
    deleteRepoCustomReviewer: async (repoId, botId) => {
      await commitRepositorySettings(repoId, (current) => ({
        customReviewers: current.customReviewers.filter((bot) => bot.id !== botId),
        activeAgentIds: current.activeAgentIds?.filter((id) => id !== botId) ?? null,
      }));
    },
    resetRepoToGlobal: async (repoId) => {
      await commitRepositorySettings(repoId, () => ({ activeAgentIds: null }));
    },
  };
}
