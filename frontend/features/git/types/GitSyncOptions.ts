export interface GitSyncOptions {
  remote?: string;
  branch?: string;
  rebase?: boolean;
  autostash?: boolean;
  ff_only?: boolean;
  no_commit?: boolean;
  no_ff?: boolean;
  squash?: boolean;
  prune?: boolean;
}
