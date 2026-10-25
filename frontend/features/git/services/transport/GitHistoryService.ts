import type { GitCommitRecord } from '../../types/GitCommitRecord';
import type { ConflictFilePreview } from '../../types/ConflictFilePreview';
import type { ConflictReport } from '../../types/ConflictReport';
import type { FileBlamePayload } from '../../types/FileBlamePayload';
import type { GitGraph } from '../../types/GitGraph';
import type { MrDiffPayload } from '../../types/MrDiffPayload';

/** Feature-owned backend contract. Inputs retain the existing wire field names. */
export interface GitHistoryService {
  checkMergeConflicts(input: {
    repoPath: string;
    base: string;
    compare: string;
  }): Promise<ConflictReport>;
  getCommitsBetweenRefs(input: {
    repoPath: string;
    base: string;
    compare: string;
  }): Promise<GitCommitRecord[]>;
  getConflictedFilePreview(input: {
    repoPath: string;
    base: string;
    compare: string;
    filePath: string;
  }): Promise<ConflictFilePreview>;
  getCurrentBranchGraph(input: {
    repoPath: string;
  }): Promise<GitGraph>;
  getFileBlame(input: {
    repoPath: string;
    filePath: string;
    revision: string | null;
    ignoreWhitespace: boolean;
  }): Promise<FileBlamePayload>;
  getGitCommitMessage(input: {
    repoPath: string;
    commitHash: string;
  }): Promise<string>;
  getGitRefSha(input: {
    repoPath: string;
    reference: string;
  }): Promise<string>;
  getGitUserIdentityCmd(input: {
    repoPath: string;
  }): Promise<[string, string]>;
  getMrDiff(input: {
    repoPath: string;
    base: string;
    compare: string;
  }): Promise<MrDiffPayload>;
  searchGitCommitMessages(input: {
    repoPath: string;
    query: string;
    caseSensitive: boolean;
    commitHashes: string[];
  }): Promise<string[]>;
}
