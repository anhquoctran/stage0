/** A portable directory leaf, never a path or a Windows device name. */
export function sanitizeCloneRepoName(name: string): string {
  const safe = name.normalize('NFKC')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^[.\s-]+|[.\s-]+$/g, '')
    .slice(0, 120)
    .replace(/[.\s-]+$/g, '');
  if (!safe) return 'repository';
  return /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(safe) ? `repo-${safe}` : safe;
}

export function extractCloneRepoName(remote: string): string {
  const trimmed = remote.trim();
  if (!trimmed) return '';
  let remotePath: string;
  try {
    remotePath = new URL(trimmed).pathname;
  } catch {
    const scp = trimmed.match(/^[^\s/@:]+@[^\s/:]+:(.+)$/);
    if (!scp) return '';
    remotePath = scp[1];
  }
  let leaf = remotePath.replace(/\/+$/, '').split('/').pop() || '';
  if (!leaf) return '';
  try { leaf = decodeURIComponent(leaf); } catch { /* Sanitize malformed escapes too. */ }
  return sanitizeCloneRepoName(leaf.replace(/\.git$/i, ''));
}

export function isSafeCloneRepoName(name: string): boolean {
  return !!name && name === sanitizeCloneRepoName(name);
}
