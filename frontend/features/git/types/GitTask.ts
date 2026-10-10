import type { GitSyncOperation } from './GitSyncOperation';
import type { GitTaskStatus } from './GitTaskStatus';
import type { RepoInfo } from './RepoInfo';

export interface GitTask {
  id: string;
  operation: 'clone' | GitSyncOperation;
  title: string;
  repositoryPath: string;
  status: GitTaskStatus;
  phase: string;
  progress: number | null;
  message: string;
  error: string | null;
  startedAt: number;
  finishedAt: number | null;
  background: boolean;
  resultRepository: RepoInfo | null;
}
