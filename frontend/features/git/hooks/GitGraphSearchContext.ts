import type { GitGraph } from '../types/GitGraph';
import type { GitGraphCommit } from '../types/GitGraphCommit';

export interface GitGraphSearchContext {
  isOpen: boolean;
  repoPath: string;
  graph: GitGraph | null;
  commits: GitGraphCommit[];
}
