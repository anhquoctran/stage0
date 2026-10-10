import type { ChangedFile } from './ChangedFile';

export interface MrDiffPayload {
  base_commit: string;
  compare_commit: string;
  files: ChangedFile[];
  raw_diff: string;
}
