import React, { useState } from 'react';
import { Copy } from '../../../common/components/icons/Copy';
import { Check } from '../../../common/components/icons/Check';
import { useGitStore } from '../../git/store/useGitStore';
import type { VirtualMrDiscussion } from '../types/VirtualMrDiscussion';

export const DiscussionCodeContext: React.FC<{
  discussion: Pick<
    VirtualMrDiscussion,
    'filePath' | 'lineNumber' | 'diffSide' | 'commitId' | 'codeSnippet'
  >;
}> = ({ discussion }) => {
  const { showToast } = useGitStore();
  const [copied, setCopied] = useState(false);

  if (!discussion.filePath) return null;

  const handleCopyPath = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(discussion.filePath || '');
      setCopied(true);
      showToast('Copied file path to clipboard', 'info');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('Could not copy file path', 'error');
    }
  };

  const selectedLine = discussion.codeSnippet?.selectedLine ?? discussion.lineNumber;
  const startLine = discussion.codeSnippet?.startLine ?? selectedLine ?? 1;

  // Parse code snippet lines to extract old/new line numbers and diff changes
  let currentOld = startLine;
  let currentNew = startLine;

  const parsedLines = (discussion.codeSnippet?.lines || []).map((rawLine, index) => {
    const raw = rawLine.replace(/\r$/, '');
    let type: 'del' | 'add' | 'context' = 'context';
    let text = raw;

    if (raw.startsWith('-')) {
      type = 'del';
      text = raw.slice(1);
    } else if (raw.startsWith('+')) {
      type = 'add';
      text = raw.slice(1);
    } else if (raw.startsWith(' ')) {
      type = 'context';
      text = raw.slice(1);
    } else {
      // Plain text without git diff prefix
      const lineNum = startLine + index;
      if (lineNum === selectedLine) {
        type = discussion.diffSide === 'left' ? 'del' : 'add';
      } else {
        type = 'context';
      }
    }

    let oldNum: number | undefined;
    let newNum: number | undefined;

    if (type === 'del') {
      oldNum = currentOld++;
      newNum = undefined;
    } else if (type === 'add') {
      oldNum = undefined;
      newNum = currentNew++;
    } else {
      oldNum = currentOld++;
      newNum = currentNew++;
    }

    return { oldNum, newNum, type, text };
  });

  return (
    <div className="overflow-hidden border border-surface1 bg-crust text-xs font-sans">
      {/* File Path Header matching GitLab style */}
      <div className="flex items-center justify-between border-b border-surface1 bg-mantle/80 px-3.5 py-1.5 rounded-sm">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-text truncate font-mono text-xs" title={discussion.filePath}>
            {discussion.filePath}
          </span>
          <button
            type="button"
            onClick={handleCopyPath}
            className="p-1 text-subtext0 hover:text-text hover:bg-surface0 transition-colors cursor-pointer rounded-sm"
            title="Copy file path"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>

        {discussion.commitId && (
          <span className="font-mono text-[10px] text-subtext0 hidden sm:inline" title={discussion.commitId}>
            Snapshot {discussion.commitId.slice(0, 8)}
          </span>
        )}
      </div>

      {/* Code diff lines preview */}
      {parsedLines.length > 0 ? (
        <div className="overflow-x-auto py-0.5 select-text bg-[#181825] rounded-sm" aria-label="Discussion code snippet">
          <table className="w-full border-collapse font-mono text-[11px] leading-5">
            <tbody>
              {parsedLines.map((row, idx) => {
                const isDeletion = row.type === 'del';
                const isAddition = row.type === 'add';

                return (
                  <tr
                    key={idx}
                    className={`transition-colors ${
                      isDeletion
                        ? 'bg-red-500/15 text-red-200'
                        : isAddition
                        ? 'bg-emerald-500/15 text-emerald-200'
                        : 'text-subtext1 hover:bg-surface0/30'
                    }`}
                  >
                    {/* Old line number */}
                    <td
                      className={`w-10 select-none text-right pr-2 border-r border-surface0/50 ${
                        isDeletion ? 'bg-red-500/25 text-red-300 font-semibold' : 'text-subtext0 bg-mantle/30'
                      }`}
                    >
                      {row.oldNum ?? ''}
                    </td>

                    {/* New line number */}
                    <td
                      className={`w-10 select-none text-right pr-2 border-r border-surface0/50 ${
                        isAddition ? 'bg-emerald-500/25 text-emerald-300 font-semibold' : 'text-subtext0 bg-mantle/30'
                      }`}
                    >
                      {row.newNum ?? ''}
                    </td>

                    {/* Diff indicator sign (+ / -) */}
                    <td
                      className={`w-5 select-none text-center font-bold ${
                        isDeletion ? 'text-red-400' : isAddition ? 'text-emerald-400' : 'text-transparent'
                      }`}
                    >
                      {isDeletion ? '-' : isAddition ? '+' : ' '}
                    </td>

                    {/* Code content */}
                    <td className="whitespace-pre px-2 font-mono text-[11px]">
                      {row.text || ' '}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-3 py-2 text-[11px] text-subtext0 italic">No saved code snippet for this discussion.</p>
      )}
    </div>
  );
};
