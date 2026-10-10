import React, { useEffect, useMemo, useState } from 'react';
import { GitMerge } from '../../../common/components/icons/GitMerge';
import { GitBranch } from '../../../common/components/icons/GitBranch';
import { X } from '../../../common/components/icons/X';
import { CustomSelect } from '../../../common/components/CustomSelect';
import type { CustomSelectOption } from '../../../common/types/CustomSelectOption';
import { useGitStore } from '../store/useGitStore';

export const MergeFromModal: React.FC = () => {
  const { branches, isSyncing, isMergeFromOpen, setIsMergeFromOpen, runSync } = useGitStore();
  const [selectedBranch, setSelectedBranch] = useState('');
  const [noCommit, setNoCommit] = useState(false);
  const [noFastForward, setNoFastForward] = useState(false);
  const [fastForwardOnly, setFastForwardOnly] = useState(false);
  const [squash, setSquash] = useState(false);

  const branchOptions = useMemo(
    () => [...new Set([...(branches?.local ?? []), ...(branches?.remote ?? [])])],
    [branches]
  );
  const branchSelectOptions: CustomSelectOption<string>[] = [
    ...(branches?.local ?? []).map((branch) => ({
      value: branch,
      label: branch === branches?.current ? `${branch} (current branch)` : branch,
      group: 'Local Branches',
      disabled: branch === branches?.current,
    })),
    ...(branches?.remote ?? []).map((branch) => ({
      value: branch,
      label: branch,
      group: 'Remote Branches',
    })),
  ];

  useEffect(() => {
    if (!isMergeFromOpen || !branches) return;
    const upstream = branches.remote.find((branch) =>
      branch.endsWith(`/${branches.current}`)
    );
    const defaultBranch =
      upstream ||
      (branches.local.includes('main') && branches.current !== 'main' ? 'main' : '') ||
      (branches.local.includes('master') && branches.current !== 'master' ? 'master' : '') ||
      branchOptions.find((branch) => branch !== branches.current) ||
      '';
    setSelectedBranch(defaultBranch);
    setNoCommit(false);
    setNoFastForward(false);
    setFastForwardOnly(false);
    setSquash(false);
  }, [isMergeFromOpen, branches, branchOptions]);

  if (!isMergeFromOpen) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const branch = selectedBranch.trim();
    if (!branch) return;

    await runSync('merge', {
      branch,
      no_commit: noCommit,
      no_ff: noFastForward,
      ff_only: fastForwardOnly,
      squash,
    });
  };

  const commandPreview = `git merge${noFastForward ? ' --no-ff' : ''}${fastForwardOnly ? ' --ff-only' : ''}${noCommit ? ' --no-commit' : ''}${squash ? ' --squash' : ''} ${selectedBranch || '<branch>'}`;

  return (
    <div className="fixed inset-x-0 bottom-0 top-8.5 z-50 bg-crust/75 backdrop-blur-xs flex items-center justify-center p-4 select-none animate-in fade-in duration-150">
      <div className="bg-mantle border border-surface0 max-w-lg w-full shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
        <div data-tauri-drag-region className="px-5 py-3.5 border-b border-surface0 flex items-center justify-between bg-base/60">
          <div data-tauri-drag-region className="flex items-center gap-2.5 pointer-events-none">
            <div className="w-7 h-7 bg-surface0 border border-surface1 flex items-center justify-center">
              <GitMerge className="w-4 h-4 text-subtext0" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-text">Merge into Current Branch</h3>
              <p className="text-[11px] text-subtext0">
                Merge changes into <span className="font-mono text-text font-semibold">{branches?.current || 'HEAD'}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsMergeFromOpen(false)}
            className="p-1.5 hover:bg-surface0 text-subtext0 hover:text-text transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-[11px] font-medium text-subtext0 mb-1.5 flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5" />
              <span>Branch to merge</span>
            </label>
            {branchOptions.length > 0 ? (
              <CustomSelect
                autoFocus
                value={selectedBranch}
                options={branchSelectOptions}
                onChange={setSelectedBranch}
                className="w-full"
                buttonClassName="w-full py-2 font-mono"
                dropdownWidth="w-full"
                align="left"
                placeholder="Select a branch…"
                aria-label="Branch to merge"
              />
            ) : (
              <input
                autoFocus
                value={selectedBranch}
                onChange={(event) => setSelectedBranch(event.target.value)}
                placeholder="e.g. main or origin/main"
                className="w-full px-3 py-2 bg-base border border-surface1 text-xs text-text focus:outline-none focus:border-primary font-mono"
              />
            )}
          </div>

          <div className="space-y-2 pt-2 border-t border-surface0/80">
            <span className="text-[11px] font-bold uppercase tracking-wider text-subtext0 block mb-1">Merge Options</span>
            <label className="flex items-start gap-2.5 cursor-pointer py-1">
              <input type="checkbox" checked={noCommit} onChange={(event) => setNoCommit(event.target.checked)} className="mt-0.5 accent-text cursor-pointer" />
              <span className="text-xs text-text">Do not create a merge commit automatically (<code className="font-mono">--no-commit</code>)</span>
            </label>
            <label className="flex items-start gap-2.5 cursor-pointer py-1">
              <input type="checkbox" checked={noFastForward} disabled={fastForwardOnly} onChange={(event) => setNoFastForward(event.target.checked)} className="mt-0.5 accent-text cursor-pointer disabled:opacity-40" />
              <span className={`text-xs text-text ${fastForwardOnly ? 'opacity-40' : ''}`}>Always create a merge commit (<code className="font-mono">--no-ff</code>)</span>
            </label>
            <label className="flex items-start gap-2.5 cursor-pointer py-1">
              <input type="checkbox" checked={fastForwardOnly} disabled={noFastForward} onChange={(event) => setFastForwardOnly(event.target.checked)} className="mt-0.5 accent-text cursor-pointer disabled:opacity-40" />
              <span className={`text-xs text-text ${noFastForward ? 'opacity-40' : ''}`}>Allow only fast-forward merges (<code className="font-mono">--ff-only</code>)</span>
            </label>
            <label className="flex items-start gap-2.5 cursor-pointer py-1">
              <input type="checkbox" checked={squash} onChange={(event) => setSquash(event.target.checked)} className="mt-0.5 accent-text cursor-pointer" />
              <span className="text-xs text-text">Combine changes without recording merge ancestry (<code className="font-mono">--squash</code>)</span>
            </label>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 bg-base border border-surface0 text-[10px] text-subtext0 font-mono break-all">
            <span className="shrink-0">$</span><span>{commandPreview}</span>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setIsMergeFromOpen(false)} className="px-3 py-1.5 text-xs text-subtext1 hover:bg-surface0 transition-colors">Cancel</button>
            <button type="submit" disabled={isSyncing || !selectedBranch.trim()} className="px-3 py-1.5 bg-primary text-on-accent text-xs font-semibold hover:brightness-110 disabled:opacity-40 transition-colors">
              {isSyncing ? 'Merging…' : 'Merge'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
