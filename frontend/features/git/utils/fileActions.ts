import { getApplicationServices } from '../../../core/services/runtime/applicationRuntime';

/**
 * Normalizes git remote URL (SSH or HTTPS) into a browseable web URL.
 * e.g. git@github.com:anhquoctran/stage0.git -> https://github.com/anhquoctran/stage0
 */
export function formatRemoteWebUrl(remoteUrl: string): string {
  let value = remoteUrl.trim();
  if (value.startsWith('git@')) value = value.replace(/^git@([^:]+):/, 'https://$1/');
  try {
    const url = new URL(value);
    const web = url.protocol === 'ssh:' ? new URL(`https://${url.host}${url.pathname}`) : url;
    if (!['https:', 'http:'].includes(web.protocol)) return '';
    web.username = '';
    web.password = '';
    web.search = '';
    web.hash = '';
    web.pathname = web.pathname.replace(/\.git\/?$/, '');
    return web.href.replace(/\/$/, '');
  } catch { return ''; }
}

/** Provider detection uses only the parsed hostname, never credentials, path or query substrings. */
function remoteProvider(url: URL): 'azure' | 'gitlab' | 'bitbucket' | 'other' {
  const host = url.hostname.toLowerCase();
  if (host === 'dev.azure.com' || host === 'visualstudio.com' || host.endsWith('.visualstudio.com')) return 'azure';
  if (host === 'gitlab.com' || host.startsWith('gitlab.')) return 'gitlab';
  if (host === 'bitbucket.org' || host.startsWith('bitbucket.')) return 'bitbucket';
  return 'other';
}

/** Builds a remote file link with repository-relative path and ref data encoded separately. */
export function buildRemoteFileUrl(remoteUrl: string, ref: string, filePath: string): string {
  const base = formatRemoteWebUrl(remoteUrl);
  if (!base) return '';
  const cleanRef = ref.replace(/^origin\//, '');
  const cleanPath = filePath.replace(/^\/+/, '');
  const url = new URL(base);
  const provider = remoteProvider(url);
  if (provider === 'azure') {
    url.searchParams.set('path', `/${cleanPath}`);
    url.searchParams.set('version', `GB${cleanRef}`);
    return url.href;
  }
  const encodedPath = cleanPath.split('/').map(encodeURIComponent).join('/');
  const route = provider === 'gitlab' ? '/-/blob' : provider === 'bitbucket' ? '/src' : '/blob';
  return `${base}${route}/${encodeURIComponent(cleanRef)}/${encodedPath}`;
}

export function buildRemoteCommitUrl(remoteUrl: string, commitSha: string): string {
  const base = formatRemoteWebUrl(remoteUrl);
  if (!base) return '';
  const provider = remoteProvider(new URL(base));
  const route = provider === 'gitlab' ? '/-/commit' : provider === 'bitbucket' ? '/commits' : '/commit';
  return `${base}${route}/${encodeURIComponent(commitSha)}`;
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
  await getApplicationServices().gitFiles.revealFileInOs({ repoPath, filePath });
}

/**
 * Opens repository folder in specified target: 'explorer', 'vscode', or 'terminal'.
 */
export async function openRepoIn(
  repoPath: string,
  target: 'explorer' | 'vscode' | 'terminal'
): Promise<void> {
  await getApplicationServices().gitFiles.openRepoIn({ repoPath, target });
}

/**
 * Opens repository in System File Explorer
 */
export async function openRepoInExplorer(repoPath: string): Promise<void> {
  await openRepoIn(repoPath, 'explorer');
}

/**
 * Opens repository in Visual Studio Code
 */
export function formatFriendlyVsCodeError(err: unknown): string {
  const rawMsg = err instanceof Error ? err.message : String(err || '');
  const lower = rawMsg.toLowerCase();
  if (
    lower.includes('not installed') ||
    lower.includes('failed to launch') ||
    lower.includes('not found') ||
    lower.includes('path') ||
    lower.includes('applications') ||
    lower.includes('snap') ||
    lower.includes('flatpak') ||
    lower.includes('no such file')
  ) {
    if (rawMsg.includes('Visual Studio Code is not installed') || rawMsg.includes('Please install VS Code')) {
      return rawMsg.replace(/^Error:\s*/i, '');
    }
    return 'Visual Studio Code is not installed or not configured in system PATH. Please install VS Code or add "code" to PATH.';
  }
  return `Failed to open Visual Studio Code: ${rawMsg}`;
}

export async function openRepoInVsCode(repoPath: string): Promise<void> {
  try {
    await openRepoIn(repoPath, 'vscode');
  } catch (err) {
    throw new Error(formatFriendlyVsCodeError(err));
  }
}

/**
 * Opens repository in System Default Terminal
 */
export async function openRepoInTerminal(repoPath: string): Promise<void> {
  await openRepoIn(repoPath, 'terminal');
}

/**
 * Opens specific file in Visual Studio Code, optionally jumping to a specific line number.
 */
export async function openFileInEditor(
  repoPath: string,
  filePath: string,
  lineNumber?: number
): Promise<void> {
  try {
    await getApplicationServices().gitFiles.openFileInEditor({
      repoPath,
      filePath,
      lineNumber: lineNumber || null,
    });
  } catch (err) {
    throw new Error(formatFriendlyVsCodeError(err));
  }
}

/**
 * Returns the OS-specific file manager name ('Finder' on macOS, 'File Manager' on Linux, 'File Explorer' on Windows).
 */
export function getOsFileManagerName(): string {
  if (typeof navigator === 'undefined') return 'File Explorer';
  const ua = navigator.userAgent || '';
  const platform =
    (navigator as unknown as { userAgentData?: { platform?: string } })
      .userAgentData?.platform ||
    navigator.platform ||
    '';
  if (/Mac|iPod|iPhone|iPad/i.test(platform) || /Mac/i.test(ua)) {
    return 'Finder';
  }
  if (/Linux/i.test(platform) || /Linux/i.test(ua)) {
    return 'File Manager';
  }
  return 'File Explorer';
}

/**
 * Fetches the remote URL for a repository from git.
 */
export async function getRemoteUrl(repoPath: string, remote?: string): Promise<string> {
  return await getApplicationServices().gitRepositories.getGitRemoteUrl({
    repoPath,
    remote: remote || null,
  });
}
