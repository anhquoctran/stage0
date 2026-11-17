import type { BotReviewer } from './BotReviewer';

export interface RepoSettings {
  repoId: string;
  revision?: string;
  validationError?: string | null;
  defaultBaseBranch: string;
  inheritGlobalAgents: boolean;
  customAgentRules?: string;
  activeAgentIds: string[];
  customReviewers?: BotReviewer[];
}
