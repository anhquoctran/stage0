import type { GitCredentialProvider } from './GitCredentialProvider';
import type { GitCredentialType } from './GitCredentialType';
import type { GitCredentialSource } from './GitCredentialSource';

export interface GitCredential {
  id: string;
  provider: GitCredentialProvider;
  server_url: string;
  account_name: string;
  token_ref: string;
  token_type: GitCredentialType;
  label?: string | null;
  source: GitCredentialSource;
  helper_name?: string | null;
  created_at: string;
  updated_at: string;
  is_in_keyring: boolean;
}
