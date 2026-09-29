export interface RepoInfo {
  id: string;
  name: string;
  local_path: string;
}

export interface BranchList {
  current: string;
  local: string[];
  remote: string[];
}

export type FileStatus = 'ADDED' | 'MODIFIED' | 'DELETED' | 'RENAMED';

export interface ChangedFile {
  path: string;
  old_path?: string;
  status: FileStatus;
  additions: number;
  deletions: number;
  is_conflicted: boolean;
}

export interface MrDiffPayload {
  base_commit: string;
  compare_commit: string;
  files: ChangedFile[];
  raw_diff: string;
}

export interface ConflictReport {
  has_conflicts: boolean;
  conflicted_files: string[];
}

export type ViewMode = 'split' | 'unified';

export interface RepoValidation {
  is_valid: boolean;
  exists: boolean;
  has_git: boolean;
  has_permission: boolean;
  error_message?: string | null;
}

export type GitSyncOperation =
  | 'fetch'
  | 'pull'
  | 'rebase'
  | 'rebase_continue'
  | 'rebase_abort'
  | 'rebase_skip';

export interface GitSyncOptions {
  remote?: string;
  branch?: string;
  rebase?: boolean;
  autostash?: boolean;
  ff_only?: boolean;
  no_commit?: boolean;
  prune?: boolean;
}

