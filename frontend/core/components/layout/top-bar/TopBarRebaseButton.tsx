import React, { useState, useRef, useEffect } from 'react';
import { GitBranch } from '../../../../common/components/icons/GitBranch';
import { ChevronDown } from '../../../../common/components/icons/ChevronDown';
import { Play } from '../../../../common/components/icons/Play';
import { SkipForward } from '../../../../common/components/icons/SkipForward';
import { Undo2 } from '../../../../common/components/icons/Undo2';
import { useGitStore } from '../../../../features/git/store/useGitStore';

export const TopBarRebaseButton: React.FC<{
  shortcut: (value: string) => string;
}> = ({ shortcut }) => {
  const { isSyncing, runSync, setIsRebaseFromOpen, isRebasing } = useGitStore();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div
      ref={menuRef}
      className={`relative flex items-stretch transition-colors cursor-pointer ${
        isOpen
          ? 'bg-surface0 text-primary'
          : 'text-subtext1 hover:bg-surface0 hover:text-text'
      }`}
    >
      <button
        type="button"
        disabled={isSyncing}
        onClick={() => runSync('rebase')}
        className="h-12 px-3 flex flex-col items-center justify-center transition-colors disabled:opacity-40 cursor-pointer min-w-[58px] rounded-sm"
        title={shortcut('Rebase (Ctrl+Shift+R)')}
      >
        <GitBranch className="w-5 h-5 text-primary shrink-0 transition-colors" />
        <span className="text-[11px] font-medium leading-none mt-1.5 tracking-tight transition-colors">
          Rebase
        </span>
      </button>

      <button
        type="button"
        disabled={isSyncing}
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative flex items-center justify-center px-1.5 h-12 transition-colors cursor-pointer rounded-sm"
        title={shortcut('Rebase options (Ctrl+Alt+R)')}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-1/2 h-8 w-px -translate-y-1/2 bg-surface1/80"
        />
        <ChevronDown className="w-2.5 h-2.5 text-current transition-colors" />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-60 shadow-2xl bg-mantle border border-surface0 py-1 z-50 animate-in fade-in duration-100 rounded-sm">
          <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-subtext0 border-b border-surface0 mb-1 rounded-sm">
            Rebase Options
          </div>
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              runSync('rebase');
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface0 text-xs text-text hover:text-primary text-left transition-colors cursor-pointer group rounded-sm"
          >
            <div className="flex items-center gap-2">
              <GitBranch className="w-3.5 h-3.5 text-current transition-colors" />
              <span>Rebase</span>
            </div>
            <span className="text-[10px] text-subtext0 font-mono">{shortcut('Ctrl+Shift+R')}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              setIsRebaseFromOpen(true);
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface0 text-xs text-text hover:text-primary text-left transition-colors cursor-pointer group rounded-sm"
          >
            <div className="flex items-center gap-2">
              <GitBranch className="w-3.5 h-3.5 text-current transition-colors" />
              <span>Rebase from...</span>
            </div>
            <span className="text-[10px] text-subtext0 font-mono">{shortcut('Ctrl+Alt+R')}</span>
          </button>

          <div className="my-1 border-t border-surface0" />

          <div className="px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-subtext0">
            In-Progress Actions
          </div>

          <button
            type="button"
            disabled={isSyncing || !isRebasing}
            onClick={() => {
              setIsOpen(false);
              runSync('rebase_continue');
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface0 text-xs text-text hover:text-primary text-left transition-colors cursor-pointer group disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed rounded-sm"
          >
            <div className="flex items-center gap-2">
              <Play className="w-3.5 h-3.5 text-current transition-colors" />
              <span>Continue Rebase</span>
            </div>
          </button>

          <button
            type="button"
            disabled={isSyncing || !isRebasing}
            onClick={() => {
              setIsOpen(false);
              runSync('rebase_skip');
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface0 text-xs text-text hover:text-primary text-left transition-colors cursor-pointer group disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed rounded-sm"
          >
            <div className="flex items-center gap-2">
              <SkipForward className="w-3.5 h-3.5 text-current transition-colors" />
              <span>Skip Commit</span>
            </div>
          </button>

          <button
            type="button"
            disabled={isSyncing || !isRebasing}
            onClick={() => {
              setIsOpen(false);
              runSync('rebase_abort');
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface0 text-xs text-text hover:text-primary text-left transition-colors cursor-pointer group disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed rounded-sm"
          >
            <div className="flex items-center gap-2">
              <Undo2 className="w-3.5 h-3.5 text-current transition-colors" />
              <span>Abort Rebase</span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};

