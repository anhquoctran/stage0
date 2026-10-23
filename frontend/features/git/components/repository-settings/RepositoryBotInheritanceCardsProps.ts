import type { BotReviewer } from '../../../virtual-mr/types/BotReviewer';
import type { GitState } from '../../types/GitState';
export interface RepositoryBotInheritanceCardsProps {
  setInheritAgents: (inherit: boolean) => void;
  inheritAgents: boolean;
  globalReviewers: BotReviewer[];
  onClose: () => void;
  setIsPreferencesOpen: (open: boolean) => void;
  activeBotSet: Set<string>;
  resetRepoToGlobal: (repoId: string) => void;
  currentRepoId: string;
  showToast: (msg: string, level?: GitState['toastLevel']) => void;
}
