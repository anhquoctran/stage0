export function extractFileHunks(
  rawDiff: string,
  filePath: string,
  oldPath?: string
): string[] {
  if (!rawDiff || !filePath) return [];

  // Normalize path separators in case Windows paths are passed
  const normPath = filePath.replace(/\\/g, '/');
  const normOldPath = oldPath ? oldPath.replace(/\\/g, '/') : undefined;

  const rawSections = rawDiff.split(/(?=^diff --git )/m);

  const targetSection = rawSections.find((section) => {
    const firstLine = section.split('\n')[0] || '';
    if (!firstLine.startsWith('diff --git ')) return false;

    // Fast exact matching on tokens
    const tokens = firstLine.split(' ');
    const matchesExact = tokens.some(
      (part) =>
        part === `b/${normPath}` ||
        part === `"b/${normPath}"` ||
        part === `a/${normPath}` ||
        part === `"a/${normPath}"` ||
        (normOldPath && (part === `a/${normOldPath}` || part === `"a/${normOldPath}"`))
    );
    if (matchesExact) return true;

    return (
      firstLine.includes(`b/${normPath}`) ||
      firstLine.includes(`a/${normPath}`) ||
      (normOldPath ? firstLine.includes(`a/${normOldPath}`) : false)
    );
  });

  if (!targetSection) return [];

  // Check if section contains hunks and diff headers
  if (!targetSection.includes('@@')) {
    return [];
  }

  // @git-diff-view/core requires the diff block containing headers (--- and +++)
  // and hunk headers (@@ ... @@)
  return [targetSection.trim()];
}

export function inferLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return 'javascript';
    case 'rs':
      return 'rust';
    case 'py':
      return 'python';
    case 'json':
      return 'json';
    case 'html':
      return 'html';
    case 'css':
    case 'scss':
      return 'css';
    case 'md':
      return 'markdown';
    case 'sql':
      return 'sql';
    case 'sh':
    case 'bash':
      return 'bash';
    case 'yml':
    case 'yaml':
      return 'yaml';
    case 'toml':
      return 'toml';
    case 'go':
      return 'go';
    case 'java':
      return 'java';
    case 'cpp':
    case 'c':
    case 'h':
    case 'hpp':
      return 'cpp';
    default:
      return 'text';
  }
}
