export interface ReviewSnapshot {
  repoPath: string;
  baseSha: string;
  headSha: string;
  mergeBaseSha: string;
  changedFiles: string[];
  excludedFiles: string[];
}
