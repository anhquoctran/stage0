import type { SandboxType } from './SandboxType';

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
