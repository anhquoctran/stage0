export type GitCredentialProvider =
  | 'github'
  | 'gitlab'
  | 'bitbucket'
  | 'azure_devops'
  | 'custom';

export type GitCredentialType =
  | 'pat'        // Personal Access Token
  | 'password'   // Username & Password
  | 'oauth'      // OAuth App Token
  | 'ssh_key';   // SSH Key / Passphrase

export interface GitCredential {
  id: string;
  provider: GitCredentialProvider;
  server_url: string;
  account_name: string;
  token_ref: string;
  token_type: GitCredentialType;
  label?: string | null;
  created_at: string;
  updated_at: string;
  is_in_keyring: boolean;
}

export interface SaveGitCredentialPayload {
  provider: GitCredentialProvider;
  server_url: string;
  account_name: string;
  token_type: GitCredentialType;
  label?: string;
  secret: string;
}

export interface OsKeyringInfo {
  os: 'windows' | 'macos' | 'linux' | 'unknown';
  keyring_name: string;
  is_available: boolean;
}

