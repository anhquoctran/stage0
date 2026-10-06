export interface GitBinaryInfo {
  id: string;
  source: string; // 'system' | 'bundled' | 'github_desktop' | 'standard' | 'homebrew' | 'xcode' | 'scoop' | 'custom'
  name: string;
  path: string;
  version: string;
  is_active: boolean;
  is_valid: boolean;
  error?: string | null;
}
