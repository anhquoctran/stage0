import type { BranchList } from '../../types/BranchList';
import type { CloneOptions } from '../../types/CloneOptions';
import type { GitOperationProgress } from '../../types/GitOperationProgress';
import type { OpenRepoOutcome } from '../../types/OpenRepoOutcome';
import type { RemoteCloneRefs } from '../../types/RemoteCloneRefs';
import type { RepoInfo } from '../../types/RepoInfo';
import type { RepoValidation } from '../../types/RepoValidation';

/** Feature-owned backend contract. Inputs retain the existing wire field names. */
export interface GitRepositoryService {
  clearRecentRepos(): Promise<unknown>;
  cloneRepository(input: {
    url: string;
    targetPath: string;
    credentialId: string | null;
    options: CloneOptions | null;
    onProgress: (progress: GitOperationProgress) => void;
  }): Promise<RepoInfo>;
  closeRepositoryWindow(): Promise<unknown>;
  deleteRecentRepo(input: {
    id: string;
  }): Promise<unknown>;
  getBranches(input: {
    repoPath: string;
  }): Promise<BranchList>;
  getCloneRemoteRefs(input: {
    url: string;
    credentialId: string | null;
  }): Promise<RemoteCloneRefs>;
  getGitRemoteUrl(input: {
    repoPath: string;
    remote: string | null;
  }): Promise<string>;
  getRecentRepos(): Promise<RepoInfo[]>;
  listGitRemotes(input: {
    repoPath: string;
  }): Promise<string[]>;
  openRepoByPath(input: {
    repoPath: string;
  }): Promise<OpenRepoOutcome>;
  openRepoDialog(input: {
    forceNewWindow: boolean;
  }): Promise<OpenRepoOutcome | null>;
  validateRepo(input: {
    repoPath: string;
  }): Promise<RepoValidation>;
}
