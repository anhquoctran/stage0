import { type BotReviewer } from '../../virtual-mr/types/BotReviewer';

export interface BotReviewersState {
  // Global App Scope Reviewers
  globalReviewers: BotReviewer[];

  // Repository Scope Overrides (Keyed by repoId)
  // When inheritGlobalAgents is false for a repo, it uses these custom selections
  repoActiveBotIds: Record<string, string[]>;
  repoCustomReviewers: Record<string, BotReviewer[]>;

  // Global Actions
  addGlobalReviewer: (bot: Omit<BotReviewer, 'id'>) => string;
  updateGlobalReviewer: (id: string, updates: Partial<BotReviewer>) => void;
  deleteGlobalReviewer: (id: string) => void;
  toggleGlobalReviewer: (id: string) => void;
  resetGlobalReviewers: () => void;

  // Repo Actions
  setRepoActiveBotIds: (repoId: string, botIds: string[]) => void;
  toggleRepoActiveBotId: (repoId: string, botId: string) => void;
  addRepoCustomReviewer: (repoId: string, bot: Omit<BotReviewer, 'id'>) => string;
  updateRepoCustomReviewer: (repoId: string, botId: string, updates: Partial<BotReviewer>) => void;
  deleteRepoCustomReviewer: (repoId: string, botId: string) => void;
  resetRepoToGlobal: (repoId: string) => void;

  // Selector
  getEffectiveReviewers: (
    repoId?: string | null,
    inheritGlobalAgents?: boolean
  ) => {
    reviewers: BotReviewer[];
    allConfigured: BotReviewer[];
    isInherited: boolean;
  };
}
