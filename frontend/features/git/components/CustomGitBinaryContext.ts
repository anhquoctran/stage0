import type { GitBinaryInfo } from '../types/GitBinaryInfo';

export interface CustomGitBinaryContext {
  pickGitExecutable: () => Promise<string | null>;
  validateCustomBinary: (path: string) => Promise<GitBinaryInfo>;
  onSelectBinary: (id: string, path: string) => void;
}
