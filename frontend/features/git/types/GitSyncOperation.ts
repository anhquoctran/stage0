export type GitSyncOperation =
  | 'fetch'
  | 'pull'
  | 'rebase'
  | 'rebase_continue'
  | 'rebase_abort'
  | 'rebase_skip';
