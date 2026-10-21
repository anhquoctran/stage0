import React, { useState, useRef, useEffect } from 'react';
import { GitMerge } from '../../../../common/components/icons/GitMerge';
import { GitBranch } from '../../../../common/components/icons/GitBranch';
import { ChevronDown } from '../../../../common/components/icons/ChevronDown';
import { useGitStore } from '../../../../features/git/store/useGitStore';

export const TopBarMergeButton: React.FC = () => {
  const { isSyncing, runSync, setIsMergeFromOpen } = useGitStore();
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
        onClick={() => runSync('merge')}
        className="h-12 px-3 flex flex-col items-center justify-center transition-colors disabled:opacity-40 cursor-pointer min-w-[58px]"
        title="Merge the current branch's upstream into this branch"
      >
        <GitMerge className="w-5 h-5 text-primary shrink-0 transition-colors" />
        <span className="text-[11px] font-medium leading-none mt-1.5 tracking-tight transition-colors">
          Merge
        </span>
      </button>

      <button
        type="button"
        disabled={isSyncing}
        onClick={() => setIsOpen((open) => !open)}
        className="relative flex items-center justify-center px-1.5 h-12 transition-colors cursor-pointer"
        title="Merge options"
        aria-label="Merge options"
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-1/2 h-8 w-px -translate-y-1/2 bg-surface1/80"
        />
        <ChevronDown className="w-2.5 h-2.5 text-current transition-colors" />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-56 shadow-2xl bg-mantle border border-surface0 py-1 z-50 animate-in fade-in duration-100">
          <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-subtext0 border-b border-surface0 mb-1">
            Merge Options
          </div>
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              runSync('merge');
            }}
            className="w-full flex items-center px-3 py-1.5 hover:bg-surface0 text-xs text-text hover:text-primary text-left transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <GitMerge className="w-3.5 h-3.5" />
              Merge upstream
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              setIsMergeFromOpen(true);
            }}
            className="w-full flex items-center px-3 py-1.5 hover:bg-surface0 text-xs text-text hover:text-primary text-left transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <GitBranch className="w-3.5 h-3.5" />
              Merge from…
            </span>
          </button>
        </div>
      )}
    </div>
  );
};

