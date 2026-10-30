import { useTranslation as useUiTextTranslation } from 'react-i18next';
import React, { useEffect, useMemo, useState } from 'react';
import { CustomSelect } from '../../../common/components/CustomSelect';
import { Download } from '../../../common/components/icons/Download';
import { GitBranch } from '../../../common/components/icons/GitBranch';
import { Globe } from '../../../common/components/icons/Globe';
import { RefreshCw } from '../../../common/components/icons/RefreshCw';
import { Terminal } from '../../../common/components/icons/Terminal';
import { X } from '../../../common/components/icons/X';
import type { CustomSelectOption } from '../../../common/types/CustomSelectOption';
import { useGitStore } from '../store/useGitStore';
import { PullAdvancedOptions } from './pull/PullAdvancedOptions';

export const PullFromModal: React.FC = () => {
  const { t: translateUiText } = useUiTextTranslation();
  const { branches, remotes, isSyncing, isPullFromOpen, setIsPullFromOpen, runSync } =
    useGitStore();

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
  const remoteOptions: CustomSelectOption<string>[] = (
    remotes.length > 0 ? remotes : ['origin']
  ).map((remote) => ({ value: remote, label: remote }));
  const branchOptions: CustomSelectOption<string>[] = availableBranches.map((branch) => ({
    value: branch,
    label: branch,
  }));

  return (
    <div className="fixed inset-x-0 bottom-0 top-8.5 z-50 bg-crust/75 backdrop-blur-xs flex items-center justify-center p-4 select-none animate-in fade-in duration-150 rounded-sm">
      <div className="bg-mantle border border-surface0 max-w-lg w-full shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150 rounded-sm">
        {/* Modal Header */}
        <div
          data-tauri-drag-region
          className="px-5 py-3.5 border-b border-surface0 flex items-center justify-between bg-base/60 cursor-default rounded-sm"
        >
          <div data-tauri-drag-region className="flex items-center gap-2.5 pointer-events-none">
            <div className="w-7 h-7 bg-surface0 border border-surface1 flex items-center justify-center text-text shadow-xs rounded-sm">
              <Download className="w-4 h-4 text-subtext0" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-text">{translateUiText('git.pullDialog.title')}</h3>
              <p className="text-[11px] text-subtext0">
                {translateUiText('git.pullDialog.description')}{' '}
                <span className="font-mono text-text font-semibold">
                  {branches?.current || 'HEAD'}
                </span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsPullFromOpen(false)}
            className="p-1.5 rounded-sm hover:bg-surface0 text-subtext0 hover:text-text transition-colors cursor-pointer"
            title={translateUiText('shortcuts.close')}
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
                <span>{translateUiText('git.pullDialog.remoteRepository')}</span>
              </label>
              <CustomSelect
                value={selectedRemote}
                options={remoteOptions}
                onChange={setSelectedRemote}
                className="w-full"
                buttonClassName="w-full font-mono"
                dropdownWidth="w-full"
                align="left"
                aria-label={translateUiText('git.pullDialog.remoteRepository')}
              />
            </div>

            {/* Remote Branch Selector */}
            <div>
              <label className="block text-[11px] font-medium text-subtext0 mb-1 flex items-center gap-1.5">
                <GitBranch className="w-3.5 h-3.5 text-subtext0" />
                <span>{translateUiText('git.pullDialog.remoteBranch')}</span>
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
                  aria-label={translateUiText('git.pullDialog.remoteBranch')}
                />
              ) : (
                <input
                  type="text"
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  placeholder={translateUiText('git.pullDialog.branchPlaceholder')}
                  className="w-full px-3 py-1.5 bg-base border border-surface1 text-xs text-text focus:outline-none focus:border-surface2 font-mono rounded-sm"
                />
              )}
            </div>
          </div>

          {/* Advanced Options */}
          <PullAdvancedOptions
            useRebase={useRebase}
            setUseRebase={setUseRebase}
            setUseFfOnly={setUseFfOnly}
            useAutostash={useAutostash}
            setUseAutostash={setUseAutostash}
            useFfOnly={useFfOnly}
            useNoCommit={useNoCommit}
            setUseNoCommit={setUseNoCommit}
          />

          {/* Command Preview */}
          <div className="p-2.5 bg-base/80 border border-surface0/80 space-y-1 rounded-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-subtext0 flex items-center gap-1.5">
              <Terminal className="w-3 h-3" />
              <span>{translateUiText('git.pullDialog.commandToExecute')}</span>
            </span>
            <div className="font-mono text-xs text-text select-all truncate">{commandPreview}</div>
          </div>

          {/* Footer Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface0/80 rounded-sm">
            <button
              type="button"
              onClick={() => setIsPullFromOpen(false)}
              className="px-4 py-1.5 rounded-sm border border-surface1 hover:bg-surface1 text-subtext0 hover:text-text text-xs transition-colors cursor-pointer"
            >
              {translateUiText('common.cancel')}
            </button>

            <button
              type="submit"
              disabled={isSyncing || !selectedBranch.trim()}
              className="flex items-center gap-1.5 px-5 py-1.5 bg-brand hover:bg-brand/90 text-on-accent text-xs font-semibold transition-colors cursor-pointer shadow-md shadow-brand/20 border border-brand disabled:opacity-50 rounded-sm"
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>{translateUiText('git.pullDialog.pulling')}</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>{translateUiText('menu.commands.pull')}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
