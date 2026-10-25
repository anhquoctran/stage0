import type { GitCredential } from '../../types/GitCredential';
import type { OsKeyringInfo } from '../../types/OsKeyringInfo';
import type { SaveGitCredentialPayload } from '../../types/SaveGitCredentialPayload';

/** Feature-owned backend contract. Inputs retain the existing wire field names. */
export interface GitCredentialService {
  deleteGitCredential(input: {
    id: string;
  }): Promise<unknown>;
  getKeyringInfo(): Promise<OsKeyringInfo>;
  listGitCredentials(): Promise<GitCredential[]>;
  saveGitCredential(input: {
    payload: SaveGitCredentialPayload;
  }): Promise<GitCredential>;
  verifyGitCredential(input: {
    id: string;
  }): Promise<boolean>;
}
