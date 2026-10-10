import type { FileStatus } from './FileStatus';

export interface ChangedFile {
  path: string;
  old_path?: string;
  status: FileStatus;
  additions: number;
  deletions: number;
  is_binary: boolean;
  is_conflicted: boolean;
}
