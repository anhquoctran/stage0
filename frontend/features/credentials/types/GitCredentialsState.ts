import { type GitCredential } from './GitCredential';
import { type SaveGitCredentialPayload } from './SaveGitCredentialPayload';
import { type OsKeyringInfo } from './OsKeyringInfo';

export interface GitCredentialsState {
  credentials: GitCredential[];
  osInfo: OsKeyringInfo | null;
  isLoading: boolean;
  error: string | null;
  fetchCredentials: () => Promise<void>;
  fetchOsInfo: () => Promise<void>;
  saveCredential: (payload: SaveGitCredentialPayload) => Promise<boolean>;
  deleteCredential: (id: string) => Promise<boolean>;
  verifyCredential: (id: string) => Promise<boolean>;
  clearError: () => void;
}
