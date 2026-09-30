import React, { useState, useEffect } from 'react';
import {
  GitMerge,
  X,
  GitBranch,
  Terminal,
  RefreshCw,
  AlertTriangle,
  Play,
  RotateCcw,
  SkipForward,
} from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';

export const RebaseFromModal: React.FC = () => {
  const {
    branches,
    isSyncing,
    isRebaseFromOpen,
    setIsRebaseFromOpen,
    runSync,
    isRebasing,
  } = useGitStore();

  const [selectedTargetBranch, setSelectedTargetBranch] = useState('main');
  const [useAutostash, setUseAutostash] = useState(true);

  // Initialize selected target branch
  useEffect(() => {
    if (isRebaseFromOpen && branches) {
      if (branches.local.includes('main') && branches.current !== 'main') {
        setSelectedTargetBranch('main');
      } else if (branches.local.includes('master') && branches.current !== 'master') {
        setSelectedTargetBranch('master');
      } else if (branches.remote.includes('origin/main')) {
        setSelectedTargetBranch('origin/main');
      } else {
        const candidate = branches.local.find((b) => b !== branches.current) || 'main';
        setSelectedTargetBranch(candidate);
      }
    }
  }, [isRebaseFromOpen, branches]);

  if (!isRebaseFromOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTargetBranch.trim()) return;

    await runSync('rebase', {
      branch: selectedTargetBranch.trim(),
      autostash: useAutostash,
    });

    setIsRebaseFromOpen(false);
  };

  const handleRebaseContinue = async () => {
    await runSync('rebase_continue');
    setIsRebaseFromOpen(false);
  };

  const handleRebaseAbort = async () => {
    await runSync('rebase_abort');
    setIsRebaseFromOpen(false);
  };

  const handleRebaseSkip = async () => {
    await runSync('rebase_skip');
    setIsRebaseFromOpen(false);
  };

  const commandPreview = `git rebase ${selectedTargetBranch}${useAutostash ? ' --autostash' : ''}`;

  return (
    <div className="fixed inset-x-0 bottom-0 top-8.5 z-50 bg-crust/75 backdrop-blur-xs flex items-center justify-center p-4 select-none animate-in fade-in duration-150">
      <div className="bg-mantle border border-surface0 max-w-lg w-full shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div
          data-tauri-drag-region
          className="px-5 py-3.5 border-b border-surface0 flex items-center justify-between bg-base/60 cursor-default"
        >
          <div data-tauri-drag-region className="flex items-center gap-2.5 pointer-events-none">
            <div className="w-7 h-7 bg-surface0 border border-surface1 flex items-center justify-center text-text shadow-xs">
              <GitMerge className="w-4 h-4 text-subtext0" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-text">Rebase Current Branch</h3>
              <p className="text-[11px] text-subtext0">
                Replay commits of{' '}
                <span className="font-mono text-text font-semibold">
                  {branches?.current || 'HEAD'}
                </span>{' '}
                onto another branch
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsRebaseFromOpen(false)}
            className="p-1.5 rounded-lg hover:bg-surface0 text-subtext0 hover:text-text transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Target / Base Branch */}
          <div>
            <label className="block text-[11px] font-medium text-subtext0 mb-1 flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5 text-subtext0" />
              <span>Rebase onto Target Branch</span>
            </label>
            <select
              value={selectedTargetBranch}
              onChange={(e) => setSelectedTargetBranch(e.target.value)}
              className="w-full px-3 py-1.5 bg-base border border-surface1 text-xs text-text focus:outline-none focus:border-surface2 cursor-pointer font-mono"
            >
              <optgroup label="Local Branches">
                {branches?.local.map((b) => (
                  <option key={b} value={b} disabled={b === branches.current}>
                    {b} {b === branches.current ? '(current branch)' : ''}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Remote Branches">
                {branches?.remote.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Advanced Options */}
          <div className="space-y-2 pt-2 border-t border-surface0/80">
            <span className="text-[11px] font-bold uppercase tracking-wider text-subtext0 block mb-1">
              Options
            </span>

            {/* --autostash */}
            <label className="flex items-start gap-2.5 cursor-pointer py-1 group">
              <input
                type="checkbox"
                checked={useAutostash}
                onChange={(e) => setUseAutostash(e.target.checked)}
                className="mt-0.5 accent-text cursor-pointer"
              />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-text group-hover:text-text transition-colors">
                  Autostash uncommitted changes (<code className="font-mono">--autostash</code>)
                </div>
                <div className="text-[10px] text-subtext0">
                  Automatically stashes your local uncommitted modifications before rebasing and restores them after
                </div>
              </div>
            </label>
          </div>

          {/* In-Progress Conflict Controls */}
          <div className="p-3 bg-surface0/30 border border-surface0 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-subtext0 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-subtext0" />
                <span>Rebase In-Progress Actions:</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRebaseContinue}
                disabled={isSyncing || !isRebasing}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-surface1 hover:bg-surface2 text-text text-[11px] font-medium border border-surface2 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                title="git rebase --continue"
              >
                <Play className="w-3 h-3 text-subtext0" />
                <span>Continue</span>
              </button>

              <button
                type="button"
                onClick={handleRebaseSkip}
                disabled={isSyncing || !isRebasing}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-surface1 hover:bg-surface2 text-text text-[11px] font-medium border border-surface2 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                title="git rebase --skip"
              >
                <SkipForward className="w-3 h-3 text-subtext0" />
                <span>Skip</span>
              </button>

              <button
                type="button"
                onClick={handleRebaseAbort}
                disabled={isSyncing || !isRebasing}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-surface1 hover:bg-surface2 text-text text-[11px] font-medium border border-surface2 transition-colors cursor-pointer ml-auto disabled:opacity-40 disabled:cursor-not-allowed"
                title="git rebase --abort"
              >
                <RotateCcw className="w-3 h-3 text-subtext0" />
                <span>Abort Rebase</span>
              </button>
            </div>
          </div>

          {/* Command Preview */}
          <div className="p-2.5 bg-base/80 border border-surface0/80 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-subtext0 flex items-center gap-1.5">
              <Terminal className="w-3 h-3" />
              <span>Command to Execute:</span>
            </span>
            <div className="font-mono text-xs text-text select-all truncate">
              {commandPreview}
            </div>
          </div>

          {/* Footer Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface0/80">
            <button
              type="button"
              onClick={() => setIsRebaseFromOpen(false)}
              className="px-4 py-1.5 rounded-lg border border-surface1 hover:bg-surface1 text-subtext0 hover:text-text text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSyncing || !selectedTargetBranch.trim()}
              className="flex items-center gap-1.5 px-5 py-1.5 bg-brand hover:bg-brand/90 text-[#11111b] text-xs font-semibold transition-colors cursor-pointer shadow-md shadow-brand/20 border border-brand disabled:opacity-50"
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Rebasing...</span>
                </>
              ) : (
                <>
                  <GitMerge className="w-3.5 h-3.5" />
                  <span>Start Rebase</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
