export interface RepoInfo {
  id: string;
  name: string;
  local_path: string;
}

export type OpenRepoOutcome =
  | { action: 'opened_here'; repo: RepoInfo }
  | { action: 'focused_existing'; window_label: string; repo: RepoInfo }
  | { action: 'opened_new_window'; window_label: string; repo: RepoInfo };

export interface WindowStartupContext {
  repo: RepoInfo | null;
  restore_recent: boolean;
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
  is_binary: boolean;
  is_conflicted: boolean;
}

export interface MrDiffPayload {
  base_commit: string;
  compare_commit: string;
  files: ChangedFile[];
  raw_diff: string;
}

export interface ConflictedFileInfo {
  path: string;
  conflict_type: string;
  message: string;
  conflict_markers_count?: number;
}

export interface ConflictReport {
  has_conflicts: boolean;
  conflicted_files: string[];
  details?: ConflictedFileInfo[];
  base_branch?: string | null;
  compare_branch?: string | null;
}

export interface ConflictRegion {
  start_line: number;
  end_line: number;
  base_code: string;
  compare_code: string;
}

export interface ConflictFilePreview {
  file_path: string;
  base_branch: string;
  compare_branch: string;
  conflict_type: string;
  has_conflict_markers: boolean;
  conflict_markers_count: number;
  merged_content: string;
  base_content?: string | null;
  compare_content?: string | null;
  conflict_regions: ConflictRegion[];
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

export interface BlameCommit {
  commit_id: string;
  author: string;
  author_mail: string;
  author_time: number;
  author_tz: string;
  committer: string;
  committer_mail: string;
  committer_time: number;
  summary: string;
  previous_commit?: string | null;
}

export interface BlameLine {
  line_no: number;
  orig_line_no: number;
  commit_id: string;
  content: string;
}

export interface BlameAuthorStat {
  name: string;
  email: string;
  line_count: number;
  percentage: number;
}

export interface FileBlamePayload {
  file_path: string;
  revision: string;
  commits: Record<string, BlameCommit>;
  lines: BlameLine[];
  author_stats: BlameAuthorStat[];
  total_lines: number;
  current_user_name?: string | null;
  current_user_email?: string | null;
}

// ---------------------------------------------------------------------------
// Sandbox Adapter Interfaces
// ---------------------------------------------------------------------------

export type SandboxType = 'in_memory' | 'local_worktree' | 'docker';

export interface SandboxCapabilities {
  can_run_commands: boolean;
  can_write_files: boolean;
  isolation_level: string;
  requires_daemon: boolean;
  supports_networking: boolean;
}

export interface SandboxAdapterInfo {
  adapter_type: SandboxType;
  name: string;
  description: string;
  is_available: boolean;
  version_info?: string | null;
  status_message: string;
  capabilities: SandboxCapabilities;
}

export interface SandboxInstanceInfo {
  id: string;
  adapter_type: SandboxType;
  repo_path: string;
  base_branch: string;
  compare_branch: string;
  worktree_path?: string | null;
  container_id?: string | null;
  created_at: string;
}

export interface SandboxExecutionResult {
  command: string;
  stdout: string;
  stderr: string;
  exit_code: number;
  duration_ms: number;
  output_truncated: boolean;
}
