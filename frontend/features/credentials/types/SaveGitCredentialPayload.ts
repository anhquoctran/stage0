import type { GitCredentialProvider } from './GitCredentialProvider';
import type { GitCredentialType } from './GitCredentialType';

export interface SaveGitCredentialPayload {
  provider: GitCredentialProvider;
  server_url: string;
  account_name: string;
  token_type: GitCredentialType;
  label?: string;
  secret: string;
}
