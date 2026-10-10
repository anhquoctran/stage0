import type { GitGraphCommit } from './GitGraphCommit';

export interface GitGraph {
    branch: string;
    is_detached: boolean;
    truncated: boolean;
    commits: GitGraphCommit[];
}
