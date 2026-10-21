import type { DiscussionCodeSnippet } from '../../virtual-mr/types/DiscussionCodeSnippet';
import type { VirtualMrDiscussion } from '../../virtual-mr/types/VirtualMrDiscussion';

export function getDiffCodeSnippet(hunks: string[], side: 'left' | 'right', lineNumber: number): DiscussionCodeSnippet | null {
  const chunks: { number: number; text: string }[][] = [];
  for (const hunk of hunks) {
    let oldLine = 0;
    let newLine = 0;
    let rows: { number: number; text: string }[] | null = null;
    for (const line of hunk.split('\n')) {
      const header = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
      if (header) {
        oldLine = Number(header[1]); newLine = Number(header[2]);
        rows = []; chunks.push(rows); continue;
      }
      if (line.startsWith('diff --git ')) { rows = null; continue; }
      if (!rows || ![' ', '+', '-'].includes(line[0])) continue;
      const old = line[0] !== '+';
      const current = line[0] !== '-';
      if ((side === 'left' && old) || (side === 'right' && current)) {
        rows.push({ number: side === 'left' ? oldLine : newLine, text: `${line[0]}${line.slice(1).replace(/\r$/, '')}` });
      }
      if (old) oldLine++;
      if (current) newLine++;
    }
  }
  for (const rows of chunks) {
    const selected = rows.findIndex((row) => row.number === lineNumber);
    if (selected < 0) continue;
    const context = rows.slice(Math.max(0, selected - 3), selected + 4);
    return { startLine: context[0].number, selectedLine: lineNumber, lines: context.map((row) => row.text) };
  }
  return null;
}

export function groupInlineDiscussions(discussions: VirtualMrDiscussion[], filePath: string, oldCommit: string, newCommit: string) {
  const oldFile: Record<string, { data: VirtualMrDiscussion[] }> = {};
  const newFile: Record<string, { data: VirtualMrDiscussion[] }> = {};
  for (const discussion of discussions) {
    if (discussion.filePath !== filePath || !discussion.lineNumber || discussion.verificationStatus === 'outdated') continue;
    const side = discussion.diffSide === 'left' ? oldFile : newFile;
    const commit = discussion.diffSide === 'left' ? oldCommit : newCommit;
    if (discussion.commitId && discussion.commitId !== commit) continue;
    (side[discussion.lineNumber] ??= { data: [] }).data.push(discussion);
  }
  return { oldFile, newFile };
}

export function getClickedDiffLine(target: Element): { side: 'left' | 'right'; lineNumber: number } | null {
  const numberCell = target.closest('.diff-line-old-num, .diff-line-new-num, .diff-line-num');
  if (!numberCell) return null;
  const split = numberCell.querySelector('[data-line-num]');
  if (split) {
    const lineNumber = Number(split.getAttribute('data-line-num'));
    return lineNumber > 0 ? { side: numberCell.classList.contains('diff-line-old-num') ? 'left' : 'right', lineNumber } : null;
  }
  const old = target.closest('[data-line-old-num]') ?? numberCell.querySelector('[data-line-old-num]');
  const current = target.closest('[data-line-new-num]') ?? numberCell.querySelector('[data-line-new-num]');
  const oldSelected = !!target.closest('[data-line-old-num]');
  const newNumber = Number(current?.getAttribute('data-line-new-num'));
  const oldNumber = Number(old?.getAttribute('data-line-old-num'));
  if (oldSelected && oldNumber > 0) return { side: 'left', lineNumber: oldNumber };
  if (newNumber > 0) return { side: 'right', lineNumber: newNumber };
  return oldNumber > 0 ? { side: 'left', lineNumber: oldNumber } : null;
}
