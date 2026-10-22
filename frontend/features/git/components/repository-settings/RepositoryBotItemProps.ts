import type { AcpAgentConfig } from '../../../ai/types/AcpAgentConfig';
import type { BotReviewer } from '../../../virtual-mr/types/BotReviewer';

export interface RepositoryBotItemProps {
  bot: BotReviewer;
  toggleRepoActiveBotId: (repoId: string, botId: string) => void;
  currentRepoId: string;
  isChecked: boolean;
  isRepoExclusive: boolean;
  externalAgents: AcpAgentConfig[];
  deleteRepoCustomReviewer: (repoId: string, botId: string) => void;
}
