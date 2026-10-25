import type { GitRemoteDetail } from '../../../virtual-mr/types/GitRemoteDetail';
import type { GitTagInfo } from '../../../virtual-mr/types/GitTagInfo';

/** Feature-owned backend contract. Inputs retain the existing wire field names. */
export interface GitRemoteService {
  addGitRemote(input: {
    repoPath: string;
    name: string;
    url: string;
  }): Promise<unknown>;
  createGitBranch(input: {
    repoPath: string;
    branchName: string;
    startPoint: string | null;
  }): Promise<unknown>;
  createGitTag(input: {
    repoPath: string;
    tagName: string;
    commitRef: string | null;
    message: string | null;
  }): Promise<unknown>;
  deleteGitBranch(input: {
    repoPath: string;
    branchName: string;
    force: boolean;
  }): Promise<unknown>;
  deleteGitTag(input: {
    repoPath: string;
    tagName: string;
  }): Promise<unknown>;
  listGitRemotesDetailed(input: {
    repoPath: string;
  }): Promise<GitRemoteDetail[]>;
  listGitTags(input: {
    repoPath: string;
  }): Promise<GitTagInfo[]>;
  removeGitRemote(input: {
    repoPath: string;
    name: string;
  }): Promise<unknown>;
  renameGitBranch(input: {
    repoPath: string;
    oldName: string;
    newName: string;
  }): Promise<unknown>;
  setGitRemoteUrl(input: {
    repoPath: string;
    name: string;
    url: string;
  }): Promise<unknown>;
  testGitRemote(input: {
    repoPath: string;
    remoteOrUrl: string;
  }): Promise<string>;
}
