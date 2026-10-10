export interface OsKeyringInfo {
  os: 'windows' | 'macos' | 'linux' | 'unknown';
  keyring_name: string;
  is_available: boolean;
}
