import { invoke } from '@tauri-apps/api/core';

/**
 * Normalizes git remote URL (SSH or HTTPS) into a browseable web URL.
 * e.g. git@github.com:anhquoctran/stage0.git -> https://github.com/anhquoctran/stage0
 */
export function formatRemoteWebUrl(remoteUrl: string): string {
  let url = remoteUrl.trim();
  if (url.startsWith('git@')) {
    url = url.replace(/^git@([^:]+):/, 'https://$1/');
  } else if (url.startsWith('ssh://git@')) {
    url = url.replace(/^ssh:\/\/git@([^/]+)\//, 'https://$1/');
  }
  url = url.replace(/\.git$/, '');
  return url;
}

/**
 * Builds the direct remote web link for a file on a specific branch or commit hash.
 */
export function buildRemoteFileUrl(
  remoteUrl: string,
  ref: string,
  filePath: string
): string {
  const base = formatRemoteWebUrl(remoteUrl);
  const cleanRef = ref.replace(/^origin\//, '');
  const cleanPath = filePath.replace(/^\/+/, '');

  if (base.includes('gitlab.')) {
    return `${base}/-/blob/${encodeURIComponent(cleanRef)}/${cleanPath}`;
  }
  if (base.includes('bitbucket.')) {
    return `${base}/src/${encodeURIComponent(cleanRef)}/${cleanPath}`;
  }
  if (base.includes('dev.azure.com') || base.includes('visualstudio.com')) {
    return `${base}?path=/${cleanPath}&version=GB${encodeURIComponent(cleanRef)}`;
  }
  // GitHub / Gitea / Forgejo standard
  return `${base}/blob/${encodeURIComponent(cleanRef)}/${cleanPath}`;
}

/**
 * Builds the direct remote web link for a specific commit hash.
 */
export function buildRemoteCommitUrl(
  remoteUrl: string,
  commitSha: string
): string {
  const base = formatRemoteWebUrl(remoteUrl);
  if (base.includes('gitlab.')) {
    return `${base}/-/commit/${commitSha}`;
  }
  if (base.includes('bitbucket.')) {
    return `${base}/commits/${commitSha}`;
  }
  if (base.includes('dev.azure.com') || base.includes('visualstudio.com')) {
    return `${base}/commit/${commitSha}`;
  }
  return `${base}/commit/${commitSha}`;
}

/**
 * Converts repository path and relative file path to native absolute OS path.
 */
export function getAbsoluteFilePath(repoPath: string, relativePath: string): string {
  const isWindows =
    typeof navigator !== 'undefined' &&
    /Win/.test(navigator.platform || navigator.userAgent);
  const cleanRepo = repoPath.replace(/[/\\]+$/, '');
  const cleanRelative = relativePath.replace(/^[/\\]+/, '');
  if (isWindows) {
    return `${cleanRepo.replace(/\//g, '\\')}\\${cleanRelative.replace(/\//g, '\\')}`;
  }
  return `${cleanRepo.replace(/\\/g, '/')}/${cleanRelative.replace(/\\/g, '/')}`;
}

/**
 * Reveals a file in OS File Explorer (Windows Explorer, macOS Finder, or Linux file manager).
 */
export async function revealInOs(repoPath: string, filePath: string): Promise<void> {
  await invoke('reveal_file_in_os', { repoPath, filePath });
}

/**
 * Fetches the remote URL for a repository from git.
 */
export async function getRemoteUrl(repoPath: string, remote?: string): Promise<string> {
  return await invoke<string>('get_git_remote_url', {
    repoPath,
    remote: remote || null,
  });
}
