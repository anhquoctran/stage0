import type { RepoInfo } from './RepoInfo';

export interface WindowStartupContext {
  repo: RepoInfo | null;
  restore_recent: boolean;
}
