import type { RepoInfo } from './RepoInfo';

export type OpenRepoOutcome =
  | { action: 'opened_here'; repo: RepoInfo }
  | { action: 'focused_existing'; window_label: string; repo: RepoInfo }
  | { action: 'opened_new_window'; window_label: string; repo: RepoInfo };
