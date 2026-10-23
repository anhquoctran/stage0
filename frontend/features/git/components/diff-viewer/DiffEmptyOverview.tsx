import React from 'react';
import { FileText } from '../../../../common/components/icons/FileText';
import { GitBranch } from '../../../../common/components/icons/GitBranch';
import type { MrDiffPayload } from '../../types/MrDiffPayload';

export const DiffEmptyOverview: React.FC<{
  diffPayload: MrDiffPayload;
  baseBranch: string;
  compareBranch: string;
}> = ({ diffPayload, baseBranch, compareBranch }) => {
  const totalFiles = diffPayload.files.length;
  const totalBinaryFiles = diffPayload.files.filter((file) => file.is_binary).length;
  const totalAdditions = diffPayload.files.reduce((acc, f) => acc + f.additions, 0);
  const totalDeletions = diffPayload.files.reduce((acc, f) => acc + f.deletions, 0);

  if (totalFiles === 0) {
    const sameCommit = diffPayload.base_commit === diffPayload.compare_commit;
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-base p-8 text-center select-none rounded-sm">
        <div className="w-14 h-14 bg-surface0/60 border border-surface1 flex items-center justify-center text-subtext1 mb-4">
          <GitBranch className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-semibold text-text mb-1.5">
          {sameCommit ? 'These branches point to the same commit' : 'No file changes to review'}
        </h3>
        <p className="text-xs text-subtext1 max-w-lg leading-relaxed">
          {sameCommit ? (
            <>Both <code className="font-mono text-text">{baseBranch}</code> and <code className="font-mono text-text">{compareBranch}</code> resolve to the same commit.</>
          ) : (
            <>The compare branch <code className="font-mono text-text">{compareBranch}</code> has no file changes relative to the merge base with <code className="font-mono text-text">{baseBranch}</code>.</>
          )}
        </p>
        <p className="text-xs text-subtext0 mt-2">Choose different branches or refresh the comparison if you expected changes.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-base p-8 text-center select-none rounded-sm">
      <div className="w-16 h-16 bg-mantle border border-surface0 flex items-center justify-center text-subtext1 mb-4 shadow-md rounded-sm">
        <FileText className="w-8 h-8 text-blue" />
      </div>
      <h3 className="text-[1rem] font-bold text-text mb-1">
        Branch Comparison Ready
      </h3>
      <p className="text-xs text-subtext1 max-w-sm mb-6 leading-relaxed">
        Comparing <code className="text-blue font-mono font-semibold">{compareBranch}</code> into <code className="text-blue font-mono font-semibold">{baseBranch}</code>.
      </p>

      {/* Quick Summary Pill Cards */}
      <div className={`grid ${totalBinaryFiles > 0 ? 'grid-cols-4 max-w-xl' : 'grid-cols-3 max-w-md'} gap-3 w-full mb-6`}>
        <div className="bg-mantle border border-surface0 p-3 text-center rounded-sm">
          <div className="text-[10px] uppercase font-bold text-subtext1">Files</div>
          <div className="text-lg font-mono font-bold text-text">{totalFiles}</div>
        </div>
        <div className="bg-mantle border border-surface0 p-3 text-center rounded-sm">
          <div className="text-[10px] uppercase font-bold text-subtext1">Additions</div>
          <div className="text-lg font-mono font-bold text-green">+{totalAdditions}</div>
        </div>
        <div className="bg-mantle border border-surface0 p-3 text-center rounded-sm">
          <div className="text-[10px] uppercase font-bold text-subtext1">Deletions</div>
          <div className="text-lg font-mono font-bold text-red">-{totalDeletions}</div>
        </div>
        {totalBinaryFiles > 0 && (
          <div className="bg-mantle border border-surface0 p-3 text-center rounded-sm">
            <div className="text-[10px] uppercase font-bold text-subtext1">Binary</div>
            <div className="text-lg font-mono font-bold text-amber-400">{totalBinaryFiles}</div>
          </div>
        )}
      </div>

      <p className="text-xs text-subtext0">
        Select any file from the sidebar to inspect its side-by-side or unified diff.
      </p>
    </div>
  );
};

