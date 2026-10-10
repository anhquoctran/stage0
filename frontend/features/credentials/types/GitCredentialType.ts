export type GitCredentialType =
  | 'pat'        // Personal Access Token
  | 'password'   // Username & Password
  | 'oauth'      // OAuth App Token
  | 'ssh_key'    // SSH Key / Passphrase
  | 'managed';
