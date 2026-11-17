import type { BotReviewer } from './BotReviewer';

export interface RepositorySettingsConfig {
  schemaVersion: 1;
  defaultBaseBranch: string;
  inheritGlobalAgents: boolean;
  customAgentRules: string;
  activeAgentIds: string[] | null;
  customReviewers: Omit<BotReviewer, 'allowAcpSourceTransfer'>[];
  labels: { id: string; name: string; color: string; description?: string | null }[];
}
