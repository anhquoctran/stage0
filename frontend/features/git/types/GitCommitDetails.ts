import type { ChangedFile } from './ChangedFile';

export interface GitCommitDetails {
  hash: string;
  parents: string[];
  author_name: string;
  author_email: string;
  authored_date: string;
  message: string;
  files: ChangedFile[];
  raw_diff: string;
  truncated: boolean;
}
