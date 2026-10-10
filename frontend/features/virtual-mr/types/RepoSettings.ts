import type { BotReviewer } from './BotReviewer';

export interface RepoSettings {
  repoId: string;
  defaultBaseBranch: string;
  inheritGlobalAgents: boolean;
  customAgentRules?: string;
  activeAgentIds: string[];
  customReviewers?: BotReviewer[];
}
