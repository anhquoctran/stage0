import React from 'react';
import { GitMerge } from '../../../../common/components/icons/GitMerge';
import { ShieldAlert } from '../../../../common/components/icons/ShieldAlert';
import type { ConflictFilePreview } from '../../types/ConflictFilePreview';

export const DiffConflictRegionsBanner: React.FC<{
  activeConflictPreview: ConflictFilePreview;
  baseBranch: string;
  compareBranch: string;
  onOpen3Way: () => void;
}> = ({ activeConflictPreview, baseBranch, compareBranch, onOpen3Way }) => {
  return (
    <div className="mb-3 border border-red/40 bg-gradient-to-r from-red/15 via-red/10 to-red/5 p-3 shadow-xs">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-red shrink-0" />
          <span className="text-xs font-bold text-red uppercase tracking-wider">
            Merge Conflict Collision ({activeConflictPreview.conflict_regions.length} block{activeConflictPreview.conflict_regions.length > 1 ? 's' : ''})
          </span>
        </div>
        <button
          type="button"
          onClick={onOpen3Way}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-red text-white text-xs font-bold hover:bg-red/90 transition-colors cursor-pointer shadow-xs"
        >
          <GitMerge className="w-3.5 h-3.5" />
          <span>Open 3-Way Side-by-Side Inspector</span>
        </button>
      </div>
      <p className="text-[11px] text-subtext1 mb-2 leading-relaxed">
        Standard git diff only compares against the common ancestor. Both <code className="text-text font-semibold bg-surface0 px-1 py-0.5 border border-surface1">{baseBranch}</code> and <code className="text-text font-semibold bg-surface0 px-1 py-0.5 border border-surface1">{compareBranch}</code> modified overlapping lines in this file:
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono">
        {activeConflictPreview.conflict_regions.slice(0, 2).map((r, idx) => (
          <div key={idx} className="bg-mantle/90 border border-surface0 p-2 text-[11px]">
            <div className="text-[10px] font-bold text-red mb-1">
              Collision Region #{idx + 1} (Lines {r.start_line} – {r.end_line})
            </div>
            <div className="text-subtext0 truncate max-w-full">
              <span className="text-red font-semibold">Target ({baseBranch}):</span> {r.base_code.split('\n')[0] || '(empty)'}
            </div>
            <div className="text-subtext0 truncate max-w-full">
              <span className="text-blue font-semibold">Source ({compareBranch}):</span> {r.compare_code.split('\n')[0] || '(empty)'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

