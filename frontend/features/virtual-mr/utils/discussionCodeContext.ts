import type { VirtualMrDiscussion } from '../types/VirtualMrDiscussion';

export function getDiscussionPosition(
  discussion: Pick<VirtualMrDiscussion, 'lineNumber' | 'diffSide' | 'codeSnippet'>,
) {
  const start = discussion.codeSnippet?.selectedLine ?? discussion.lineNumber;
  if (!start || start < 1) return null;
  const end = Math.max(start, discussion.codeSnippet?.selectedEndLine ?? start);
  const sign = discussion.diffSide === 'left' ? '−' : discussion.diffSide === 'right' ? '+' : '';
  const version = discussion.diffSide === 'left' ? 'Old' : discussion.diffSide === 'right' ? 'New' : 'Snapshot';
  return {
    start,
    end,
    commentLabel: end > start
      ? `Comment on lines ${sign}${start} to ${sign}${end}`
      : `Comment on line ${sign}${start}`,
    shortLabel: `${version} ${end > start ? `lines ${start}–${end}` : `line ${start}`}`,
  };
}

export function getDiscussionCodeRows(
  discussion: Pick<VirtualMrDiscussion, 'lineNumber' | 'diffSide' | 'codeSnippet'>,
) {
  const snippet = discussion.codeSnippet;
  if (!snippet) return [];
  const position = getDiscussionPosition(discussion);
  // Older manual snippets already contain one side of a diff. Their source
  // line numbers advance on every row; inventing the opposite side is incorrect.
  const isDiff = snippet.format === 'diff' || (
    !snippet.format && snippet.lines.length > 0 && snippet.lines.every((line) => /^[ +\-]/.test(line))
  );
  return snippet.lines.map((line, index) => {
    const number = snippet.startLine + index;
    const raw = line.replace(/\r$/, '');
    const prefix = isDiff ? raw[0] : '';
    return {
      number,
      text: isDiff && /^[ +\-]/.test(raw) ? raw.slice(1) : raw,
      type: prefix === '+' ? 'add' : prefix === '-' ? 'del' : 'context',
      isSelected: !!position && number >= position.start && number <= position.end,
    };
  });
}
