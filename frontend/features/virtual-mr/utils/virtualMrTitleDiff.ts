export interface TitleDiffResult {
  prefix: string;
  oldDiff: string;
  newDiff: string;
  suffix: string;
}

/**
 * Computes character-level common prefix and suffix to isolate
 * the changed portion of an MR title (matching GitHub / GitLab style inline diffs).
 */
export function computeTitleDiff(oldTitle: string, newTitle: string): TitleDiffResult {
  const oldStr = oldTitle || '';
  const newStr = newTitle || '';

  let prefixLen = 0;
  const minLen = Math.min(oldStr.length, newStr.length);

  while (prefixLen < minLen && oldStr[prefixLen] === newStr[prefixLen]) {
    prefixLen++;
  }

  let suffixLen = 0;
  const maxSuffixLen = minLen - prefixLen;
  while (
    suffixLen < maxSuffixLen &&
    oldStr[oldStr.length - 1 - suffixLen] === newStr[newStr.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  const prefix = oldStr.slice(0, prefixLen);
  const oldDiff = oldStr.slice(prefixLen, oldStr.length - suffixLen);
  const newDiff = newStr.slice(prefixLen, newStr.length - suffixLen);
  const suffix = suffixLen > 0 ? oldStr.slice(oldStr.length - suffixLen) : '';

  return { prefix, oldDiff, newDiff, suffix };
}

