export type GitSyncOperation =
  | 'fetch'
  | 'pull'
  | 'merge'
  | 'rebase'
  | 'rebase_continue'
  | 'rebase_abort'
  | 'rebase_skip';
