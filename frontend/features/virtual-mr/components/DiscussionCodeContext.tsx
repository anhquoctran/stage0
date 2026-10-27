import React, { useState } from 'react';
import { Copy } from '../../../common/components/icons/Copy';
import { Check } from '../../../common/components/icons/Check';
import { useGitStore } from '../../git/store/useGitStore';
import type { VirtualMrDiscussion } from '../types/VirtualMrDiscussion';
import { getDiscussionCodeRows, getDiscussionPosition } from '../utils/discussionCodeContext';

export const DiscussionCodeContext: React.FC<{
  discussion: Pick<
    VirtualMrDiscussion,
    'filePath' | 'lineNumber' | 'diffSide' | 'commitId' | 'codeSnippet' | 'verificationStatus'
  >;
}> = ({ discussion }) => {
  const { showToast } = useGitStore();
  const [copied, setCopied] = useState(false);
  if (!discussion.filePath) return null;

  const position = getDiscussionPosition(discussion);
  const rows = getDiscussionCodeRows(discussion);
  const lastLine = rows.at(-1)?.number;
  const handleCopyPath = async (event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(discussion.filePath || '');
      setCopied(true);
      showToast('Copied file path to clipboard', 'info');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('Could not copy file path', 'error');
    }
  };

  return (
    <section className="overflow-hidden rounded-sm bg-crust text-xs" aria-label="Reviewed code location">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 bg-surface0/30 px-3.5 py-3">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <span className="min-w-0 break-all whitespace-normal font-mono text-xs font-semibold leading-5 text-text sm:text-sm">
            {discussion.filePath}
          </span>
          <button
            type="button"
            onClick={handleCopyPath}
            className="shrink-0 rounded-sm p-1 text-subtext0 transition-colors hover:bg-surface0 hover:text-text"
            aria-label="Copy file path"
            title="Copy file path"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 text-[10px] text-subtext0">
          {discussion.verificationStatus === 'outdated' && (
            <span className="rounded-sm bg-surface0 px-2 py-0.5 text-subtext1">Outdated</span>
          )}
          {discussion.commitId && (
            <span className="font-mono" title={`Reviewed snapshot: ${discussion.commitId}`}>
              Reviewed at {discussion.commitId.slice(0, 8)}
            </span>
          )}
        </div>
      </div>
      {position && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 text-xs text-subtext1">
          <p className="font-medium text-text">{position.commentLabel}</p>
          <span>{discussion.diffSide === 'left' ? 'Old version · base' : discussion.diffSide === 'right' ? 'New version · head' : 'Reviewed snapshot'}</span>
        </div>
      )}
      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-sm bg-crust select-text" aria-label="Discussion code snippet">
          <table className="w-full border-collapse font-mono text-xs leading-6">
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.number}
                  data-line-number={row.number}
                  data-selected={row.isSelected}
                  aria-label={row.isSelected ? `Issue line ${row.number}` : undefined}
                  className={`border-0 ${row.isSelected ? 'font-semibold' : ''} ${
                    row.type === 'del' ? 'bg-red-600 text-white'
                      : row.type === 'add' ? 'bg-emerald-600 text-white'
                        : row.isSelected ? 'bg-surface0 text-text' : 'bg-crust text-subtext1'
                  }`}
                >
                  <td className="w-6 border-0 text-center select-none" aria-hidden="true">{row.isSelected ? '›' : ''}</td>
                  <td className="w-12 border-0 pr-3 text-right tabular-nums select-none">{row.number}</td>
                  <td className="w-6 border-0 text-center select-none" aria-hidden="true">{row.type === 'del' ? '−' : row.type === 'add' ? '+' : ' '}</td>
                  <td className="border-0 px-2 whitespace-pre"><code>{row.text || ' '}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
          {position && lastLine && position.end > lastLine && (
            <p className="px-3.5 py-2 font-sans text-[11px] text-subtext0">
              Excerpt shows lines {rows[0].number}–{lastLine}. The comment range continues to line {position.end}.
            </p>
          )}
        </div>
      ) : (
        <p className="px-3.5 py-3 text-[11px] text-subtext0">Code from the reviewed snapshot is unavailable.</p>
      )}
    </section>
  );
};
