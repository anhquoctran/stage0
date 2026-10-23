import type { AcpAgentConfig } from '../../../ai/types/AcpAgentConfig';
import type { BotReviewer } from '../../../virtual-mr/types/BotReviewer';
import type { GitState } from '../../types/GitState';

export interface RepositoryBotFormContext {
  currentRepoId: string;
  externalAgents: AcpAgentConfig[];
  showToast: (msg: string, level?: GitState['toastLevel']) => void;
  addRepoCustomReviewer: (repoId: string, bot: Omit<BotReviewer, 'id'>) => string;
}
