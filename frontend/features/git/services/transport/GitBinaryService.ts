import type { GitBinaryInfo } from '../../types/GitBinaryInfo';

/** Feature-owned backend contract. Inputs retain the existing wire field names. */
export interface GitBinaryService {
  getActiveGitBinary(): Promise<[string, string]>;
  pickGitExecutable(): Promise<string | null>;
  scanGitBinaries(): Promise<GitBinaryInfo[]>;
  setActiveGitBinary(input: {
    id: string;
    path: string;
  }): Promise<unknown>;
  validateCustomGitBinary(input: {
    path: string;
  }): Promise<GitBinaryInfo>;
}
