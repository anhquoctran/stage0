import React from 'react';
import type { VirtualMrDiscussion } from '../types/VirtualMrDiscussion';

export const DiscussionCodeContext: React.FC<{
  discussion: Pick<VirtualMrDiscussion, 'filePath' | 'lineNumber' | 'diffSide' | 'commitId' | 'codeSnippet'>;
}> = ({ discussion }) => {
  if (!discussion.filePath) return null;
  const selectedLine = discussion.codeSnippet?.selectedLine ?? discussion.lineNumber;
  return (
    <div className="overflow-hidden border border-surface1 bg-crust text-xs">
      <div className="flex flex-wrap items-center gap-2 border-b border-surface0 px-3 py-2 text-subtext0">
        <span className="min-w-0 break-all font-mono text-text">{discussion.filePath}</span>
        <span>{discussion.diffSide === 'left' ? 'Old' : 'New'} line {selectedLine}</span>
        {discussion.commitId && <span title={discussion.commitId} className="font-mono text-[10px]">Snapshot {discussion.commitId.slice(0, 8)}</span>}
      </div>
      {discussion.codeSnippet ? (
        <div className="max-h-48 overflow-auto py-1" aria-label="Discussion code snippet">
          {discussion.codeSnippet.lines.map((line, index) => {
            const number = discussion.codeSnippet!.startLine + index;
            return (
              <div key={number} className={`flex min-w-max font-mono text-[11px] leading-5 ${number === selectedLine ? 'bg-brand/15 text-text' : 'text-subtext1'}`}>
                <span className="w-12 shrink-0 select-none border-r border-surface0 px-2 text-right text-subtext0">{number}</span>
                <code className="whitespace-pre px-3">{line || ' '}</code>
              </div>
            );
          })}
        </div>
      ) : <p className="px-3 py-2 text-[11px] text-subtext0">No saved code snippet for this discussion.</p>}
    </div>
  );
};
