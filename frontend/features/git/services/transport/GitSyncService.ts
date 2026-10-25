import type { GitOperationProgress } from '../../types/GitOperationProgress';
import type { GitSyncOperation } from '../../types/GitSyncOperation';
import type { GitSyncOptions } from '../../types/GitSyncOptions';

/** Feature-owned backend contract. Inputs retain the existing wire field names. */
export interface GitSyncService {
  checkRebaseStatus(input: {
    repoPath: string;
  }): Promise<boolean>;
  runGitSync(input: {
    repoPath: string;
    operation: GitSyncOperation;
    options: GitSyncOptions | null;
    onProgress: (progress: GitOperationProgress) => void;
  }): Promise<string>;
}
