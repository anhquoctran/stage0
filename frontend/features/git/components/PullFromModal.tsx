import React, { useState, useEffect, useMemo } from 'react';
import { Download } from '../../../common/components/icons/Download';
import { X } from '../../../common/components/icons/X';
import { GitBranch } from '../../../common/components/icons/GitBranch';
import { Globe } from '../../../common/components/icons/Globe';
import { RefreshCw } from '../../../common/components/icons/RefreshCw';
import { Terminal } from '../../../common/components/icons/Terminal';
import { CustomSelect } from '../../../common/components/CustomSelect';
import type { CustomSelectOption } from '../../../common/types/CustomSelectOption';
import { useGitStore } from '../store/useGitStore';

export const PullFromModal: React.FC = () => {
  const {
    branches,
    remotes,
    isSyncing,
    isPullFromOpen,
    setIsPullFromOpen,
    runSync,
  } = useGitStore();

  const [selectedRemote, setSelectedRemote] = useState('origin');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [useRebase, setUseRebase] = useState(true);
  const [useAutostash, setUseAutostash] = useState(true);
  const [useFfOnly, setUseFfOnly] = useState(false);
  const [useNoCommit, setUseNoCommit] = useState(false);

  // Available remote branches for the selected remote
  const availableBranches = useMemo(() => {
    if (!branches?.remote) return [];
    const prefix = `${selectedRemote}/`;
    return branches.remote
      .filter((b) => b.startsWith(prefix))
      .map((b) => b.substring(prefix.length));
  }, [branches, selectedRemote]);

  // Set initial selected remote & branch when modal opens
  useEffect(() => {
    if (isPullFromOpen) {
      const defaultRemote = remotes.length > 0 ? remotes[0] : 'origin';
      setSelectedRemote(defaultRemote);

      const current = branches?.current || '';
      if (current && availableBranches.includes(current)) {
        setSelectedBranch(current);
      } else if (availableBranches.includes('main')) {
        setSelectedBranch('main');
      } else if (availableBranches.includes('master')) {
        setSelectedBranch('master');
      } else if (availableBranches.length > 0) {
        setSelectedBranch(availableBranches[0]);
      } else {
        setSelectedBranch(current || 'main');
      }
    }
  }, [isPullFromOpen, remotes, branches, availableBranches]);

  if (!isPullFromOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBranch.trim()) return;

    await runSync('pull', {
      remote: selectedRemote,
      branch: selectedBranch.trim(),
      rebase: useRebase,
      autostash: useAutostash,
      ff_only: useFfOnly,
      no_commit: useNoCommit,
    });
  };

  // Build command preview string
  const commandPreview = `git pull ${selectedRemote} ${selectedBranch}${
    useRebase ? ' --rebase' : ''
  }${useAutostash ? ' --autostash' : ''}${useFfOnly ? ' --ff-only' : ''}${
    useNoCommit ? ' --no-commit' : ''
  }`;
  const remoteOptions: CustomSelectOption<string>[] = (remotes.length > 0
    ? remotes
    : ['origin']
  ).map((remote) => ({ value: remote, label: remote }));
  const branchOptions: CustomSelectOption<string>[] = availableBranches.map((branch) => ({
    value: branch,
    label: branch,
  }));

  return (
    <div className="fixed inset-x-0 bottom-0 top-8.5 z-50 bg-crust/75 backdrop-blur-xs flex items-center justify-center p-4 select-none animate-in fade-in duration-150">
      <div className="bg-mantle border border-surface0 max-w-lg w-full shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div
          data-tauri-drag-region
          className="px-5 py-3.5 border-b border-surface0 flex items-center justify-between bg-base/60 cursor-default"
        >
          <div data-tauri-drag-region className="flex items-center gap-2.5 pointer-events-none">
            <div className="w-7 h-7 bg-surface0 border border-surface1 flex items-center justify-center text-text shadow-xs">
              <Download className="w-4 h-4 text-subtext0" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-text">Pull From Remote</h3>
              <p className="text-[11px] text-subtext0">
                Pull changes into current branch{' '}
                <span className="font-mono text-text font-semibold">
                  {branches?.current || 'HEAD'}
                </span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsPullFromOpen(false)}
            className="p-1.5 rounded-lg hover:bg-surface0 text-subtext0 hover:text-text transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {/* Remote Selector */}
            <div>
              <label className="block text-[11px] font-medium text-subtext0 mb-1 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-subtext0" />
                <span>Remote Repository</span>
              </label>
              <CustomSelect
                value={selectedRemote}
                options={remoteOptions}
                onChange={setSelectedRemote}
                className="w-full"
                buttonClassName="w-full font-mono"
                dropdownWidth="w-full"
                align="left"
                aria-label="Remote Repository"
              />
            </div>

            {/* Remote Branch Selector */}
            <div>
              <label className="block text-[11px] font-medium text-subtext0 mb-1 flex items-center gap-1.5">
                <GitBranch className="w-3.5 h-3.5 text-subtext0" />
                <span>Remote Branch</span>
              </label>
              {availableBranches.length > 0 ? (
                <CustomSelect
                  value={selectedBranch}
                  options={branchOptions}
                  onChange={setSelectedBranch}
                  className="w-full"
                  buttonClassName="w-full font-mono"
                  dropdownWidth="w-full"
                  align="left"
                  aria-label="Remote Branch"
                />
              ) : (
                <input
                  type="text"
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  placeholder="e.g. main, master"
                  className="w-full px-3 py-1.5 bg-base border border-surface1 text-xs text-text focus:outline-none focus:border-surface2 font-mono"
                />
              )}
            </div>
          </div>

          {/* Advanced Options */}
          <div className="space-y-2 pt-2 border-t border-surface0/80">
            <span className="text-[11px] font-bold uppercase tracking-wider text-subtext0 block mb-1">
              Advanced Options
            </span>

            {/* --rebase */}
            <label className="flex items-start gap-2.5 cursor-pointer py-1 group">
              <input
                type="checkbox"
                checked={useRebase}
                onChange={(e) => {
                  setUseRebase(e.target.checked);
                  if (e.target.checked) setUseFfOnly(false);
                }}
                className="mt-0.5 accent-text cursor-pointer"
              />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-text group-hover:text-text transition-colors">
                  Rebase local commits onto upstream (<code className="font-mono">--rebase</code>)
                </div>
                <div className="text-[10px] text-subtext0">
                  Maintains a clean, linear git history without creating superfluous merge commits
                </div>
              </div>
            </label>

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
                  Automatically stashes modified workspace files before pull and restores them afterward
                </div>
              </div>
            </label>

            {/* --ff-only */}
            <label className="flex items-start gap-2.5 cursor-pointer py-1 group">
              <input
                type="checkbox"
                checked={useFfOnly}
                disabled={useRebase}
                onChange={(e) => setUseFfOnly(e.target.checked)}
                className="mt-0.5 accent-text cursor-pointer disabled:opacity-40"
              />
              <div className={`min-w-0 ${useRebase ? 'opacity-40' : ''}`}>
                <div className="text-xs font-semibold text-text group-hover:text-text transition-colors">
                  Fast-forward only (<code className="font-mono">--ff-only</code>)
                </div>
                <div className="text-[10px] text-subtext0">
                  Refuses to merge if local branch has diverged, preventing accidental merge commits
                </div>
              </div>
            </label>

            {/* --no-commit */}
            <label className="flex items-start gap-2.5 cursor-pointer py-1 group">
              <input
                type="checkbox"
                checked={useNoCommit}
                disabled={useRebase}
                onChange={(e) => setUseNoCommit(e.target.checked)}
                className="mt-0.5 accent-text cursor-pointer disabled:opacity-40"
              />
              <div className={`min-w-0 ${useRebase ? 'opacity-40' : ''}`}>
                <div className="text-xs font-semibold text-text group-hover:text-text transition-colors">
                  No commit (<code className="font-mono">--no-commit</code>)
                </div>
                <div className="text-[10px] text-subtext0">
                  Merges changes into working directory but does not auto-commit, allowing review
                </div>
              </div>
            </label>
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
              onClick={() => setIsPullFromOpen(false)}
              className="px-4 py-1.5 rounded-lg border border-surface1 hover:bg-surface1 text-subtext0 hover:text-text text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSyncing || !selectedBranch.trim()}
              className="flex items-center gap-1.5 px-5 py-1.5 bg-brand hover:bg-brand/90 text-on-accent text-xs font-semibold transition-colors cursor-pointer shadow-md shadow-brand/20 border border-brand disabled:opacity-50"
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Pulling...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Pull</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
