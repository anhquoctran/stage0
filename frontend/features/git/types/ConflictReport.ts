import type { ConflictedFileInfo } from './ConflictedFileInfo';

export interface ConflictReport {
  has_conflicts: boolean;
  conflicted_files: string[];
  details?: ConflictedFileInfo[];
  base_branch?: string | null;
  compare_branch?: string | null;
}
