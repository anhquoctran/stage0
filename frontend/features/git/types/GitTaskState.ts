import type { GitTask } from './GitTask';
import type { GitOperationProgress } from './GitOperationProgress';
import type { RepoInfo } from './RepoInfo';

export interface GitTaskState {
  tasks: GitTask[];
  selectedTaskId: string | null;
  isBackgroundManagerOpen: boolean;
  setBackgroundManagerOpen: (open: boolean) => void;
  startTask: (operation: GitTask['operation'], title: string, repositoryPath: string) => string;
  updateTask: (id: string, progress: GitOperationProgress) => void;
  completeTask: (id: string, message: string, repository?: RepoInfo) => void;
  failTask: (id: string, error: string) => void;
  runInBackground: (id: string) => void;
  dismissTask: (id: string) => void;
  showTask: (id: string) => void;
}
