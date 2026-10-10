import type { GitBinaryInfo } from './GitBinaryInfo';

export interface GitBinaryState {
  binaries: GitBinaryInfo[];
  activeBinaryId: string;
  activeBinaryPath: string;
  isLoading: boolean;
  isScanning: boolean;
  error: string | null;
  scanBinaries: () => Promise<GitBinaryInfo[]>;
  fetchActiveBinary: () => Promise<{ id: string; path: string }>;
  setActiveBinary: (id: string, path: string) => Promise<boolean>;
  validateCustomBinary: (path: string) => Promise<GitBinaryInfo>;
  pickGitExecutable: () => Promise<string | null>;
  restartApp: () => Promise<void>;
  clearError: () => void;
}
