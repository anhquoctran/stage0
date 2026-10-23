import type { GitGraphCommit } from '../types/GitGraphCommit';

export interface GitCommitMessageContext {
  isOpen: boolean;
  repoPath: string;
  selectedCommit: GitGraphCommit | null;
}
