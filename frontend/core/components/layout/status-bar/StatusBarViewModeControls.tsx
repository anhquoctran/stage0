import React from 'react';
import { Columns2 } from '../../../../common/components/icons/Columns2';
import { Rows2 } from '../../../../common/components/icons/Rows2';
import { Keyboard } from '../../../../common/components/icons/Keyboard';
import { useGitStore } from '../../../../features/git/store/useGitStore';

export const StatusBarViewModeControls: React.FC<{
  isVisible: boolean;
}> = ({ isVisible }) => {
  const { viewMode, setViewMode } = useGitStore();

  if (!isVisible) return null;

  return (
    <>
      {/* View Mode Switcher */}
      <button
        type="button"
        onClick={() => setViewMode(viewMode === 'split' ? 'unified' : 'split')}
        className="h-5.5 px-2 bg-surface0/40 hover:bg-surface1/70 border border-surface1/40 hover:border-surface2 text-subtext1 hover:text-text flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs rounded-sm"
        title={`Click to switch to ${viewMode === 'split' ? 'Unified' : 'Split'} view`}
      >
        {viewMode === 'split' ? (
          <Columns2 className="w-3 h-3 text-blue shrink-0" />
        ) : (
          <Rows2 className="w-3 h-3 text-blue shrink-0" />
        )}
        <span className="capitalize max-xl:hidden">{viewMode} View</span>
      </button>

      {/* Keyboard Shortcuts Hint */}
      <div className="hidden xl:flex items-center gap-1.5 pl-1.5 text-[10px] text-subtext0/80">
        <div className="h-3 w-px bg-surface1/80 mr-1" />
        <Keyboard className="w-3 h-3 text-subtext0/60 shrink-0" />
        <span>
          <kbd className="font-mono bg-surface0/60 px-1 py-0.2 border border-surface1/40 text-subtext1">↑/↓</kbd> Files
        </span>
        <span className="text-surface2">•</span>
        <span>
          <kbd className="font-mono bg-surface0/60 px-1 py-0.2 border border-surface1/40 text-subtext1">S/U</kbd> View
        </span>
      </div>
    </>
  );
};

