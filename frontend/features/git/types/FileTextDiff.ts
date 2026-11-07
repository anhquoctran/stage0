export interface FileTextDiff {
  raw_diff: string;
  old_encoding: string | null;
  new_encoding: string | null;
  additions: number;
  deletions: number;
}
