import React, { useState, useRef, useEffect } from 'react';
import { clsx } from 'clsx';
import { invoke } from '@tauri-apps/api/core';
import {
  FolderOpen,
  ArrowLeft,
  ArrowLeftRight,
  RefreshCw,
  Download,
  GitMerge,
  ChevronDown,
  FolderGit2,
  Clock,
  RotateCw,
  GitPullRequest,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import { BranchSelector } from '../git/BranchSelector';
import { ThemeSwitcher } from './ThemeSwitcher';
import { WindowControls } from './WindowControls';
import { useGitStore } from '../../store/useGitStore';

export const TopBar: React.FC = () => {
  const {
    currentRepo,
    recentRepos,
    branches,
    baseBranch,
    compareBranch,
    diffPayload,
    isSyncing,
    syncStatus,
    openRepoDialog,
    selectRepo,
    removeRecentRepo,
    setBaseBranch,
    setCompareBranch,
    swapBranches,
    refreshDiff,
    runSync,
  } = useGitStore();

  const [isRecentOpen, setIsRecentOpen] = useState(false);
  const recentDropdownRef = useRef<HTMLDivElement>(null);

  const isMac =
    typeof navigator !== 'undefined' &&
    /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        recentDropdownRef.current &&
        !recentDropdownRef.current.contains(event.target as Node)
      ) {
        setIsRecentOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDoubleClick = (e: React.MouseEvent) => {
    // Only trigger if double clicked on non-interactive area
    if ((e.target as HTMLElement).closest('button, input, select, [role="button"], a')) {
      return;
    }
    invoke<boolean>('window_toggle_maximize').catch(() => { });
  };

  return (
    <header
      data-tauri-drag-region
      onDoubleClick={handleDoubleClick}
      className={clsx(
        'h-13 bg-mantle border-b border-surface0 flex items-center justify-between shrink-0 select-none z-20 transition-all',
        isMac ? 'pl-[76px] pr-3' : 'pl-3 pr-0'
      )}
    >
      {/* Left: Brand + Repo Selector */}
      <div className="flex items-center gap-3">
        {/* Brand */}
        <div
          data-tauri-drag-region
          className="flex items-center gap-2 pr-3 border-r border-surface0 cursor-default"
        >
          <div className="w-6 h-6 rounded-md bg-gradient-to-tr from-blue via-sapphire to-mauve flex items-center justify-center text-crust shadow-md shadow-blue/20">
            <GitPullRequest className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-extrabold tracking-tight text-text">
                Stage0
              </span>

            </div>
          </div>
        </div>

        {/* Repository Dropdown Pill (GitHub Desktop / Fork style) */}
        <div className="relative" ref={recentDropdownRef}>
          <div className="flex items-center rounded-md border border-surface0 bg-surface0 overflow-hidden hover:border-surface2 transition-colors shadow-xs">
            <button
              type="button"
              onClick={openRepoDialog}
              className="flex items-center gap-2 px-2.5 py-1 text-xs text-text hover:bg-surface1 transition-colors"
              title={currentRepo?.local_path || 'Open Local Git Repository'}
            >
              <FolderGit2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <div className="text-left max-w-[170px]">
                <span className="block font-semibold text-text truncate leading-tight text-xs">
                  {currentRepo ? currentRepo.name : 'Open Repository...'}
                </span>
                {currentRepo ? (
                  <span className="block text-[9px] text-subtext1 truncate leading-tight font-mono">
                    {currentRepo.local_path}
                  </span>
                ) : (
                  <span className="block text-[9px] text-subtext0 leading-tight">
                    Click to select folder
                  </span>
                )}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setIsRecentOpen(!isRecentOpen)}
              className="px-1.5 py-1.5 border-l border-surface0 text-subtext1 hover:text-text hover:bg-surface1 transition-colors"
              title="Recent repositories"
            >
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>

          {isRecentOpen && (
            <div className="absolute left-0 mt-1.5 w-80 rounded-md shadow-2xl bg-mantle border border-surface0 z-50 overflow-hidden py-1 animate-in fade-in duration-100">
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-subtext1 flex items-center justify-between bg-base border-b border-surface0">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3 h-3" />
                  <span>Recent Repositories</span>
                </div>
                <span className="text-[10px] text-subtext0">
                  {recentRepos.length}
                </span>
              </div>

              <div className="max-h-56 overflow-y-auto divide-y divide-surface0">
                {recentRepos.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs text-subtext0">
                    No recent repositories
                  </div>
                ) : (
                  recentRepos.map((repo) => (
                    <div
                      key={repo.id}
                      onClick={() => {
                        selectRepo(repo);
                        setIsRecentOpen(false);
                      }}
                      className="group flex items-center justify-between px-3 py-2 text-xs hover:bg-surface0 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <FolderOpen className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-text truncate">
                            {repo.name}
                          </div>
                          <div className="text-[10px] text-subtext1 truncate font-mono">
                            {repo.local_path}
                          </div>
                        </div>
                        {currentRepo?.id === repo.id && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-green shrink-0 ml-1" />
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeRecentRepo(repo.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-surface1 text-subtext0 hover:text-red transition-all shrink-0 ml-1.5"
                        title="Remove from recents"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="p-1 border-t border-surface0 bg-base">
                <button
                  type="button"
                  onClick={() => {
                    setIsRecentOpen(false);
                    openRepoDialog();
                  }}
                  className="w-full text-left px-2.5 py-1.5 text-xs text-blue hover:bg-mantle rounded flex items-center gap-2 font-medium"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Open from Disk...</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Draggable region filler */}
      <div data-tauri-drag-region className="flex-1 h-full min-w-4" />

      {/* Center: Branch Merge Sandbox Comparison */}
      {currentRepo && (
        <div className="flex items-center gap-1.5 bg-base/80 border border-surface0 rounded-lg p-1 shadow-inner shrink-0">
          <BranchSelector
            label="Base (Target)"
            value={baseBranch}
            branches={branches}
            onChange={setBaseBranch}
          />

          <div className="flex items-center gap-1 px-1">
            <span title="Compare branch will merge into Base" className="text-subtext1">
              <ArrowLeft className="w-3.5 h-3.5 text-blue" />
            </span>
            <button
              type="button"
              onClick={swapBranches}
              title="Swap Base and Compare branches"
              className="p-1.5 rounded-md bg-surface0 border border-surface0 hover:bg-surface1 text-subtext1 hover:text-blue transition-all hover:rotate-180 duration-200"
            >
              <ArrowLeftRight className="w-3 h-3" />
            </button>
          </div>

          <BranchSelector
            label="Compare (Source)"
            value={compareBranch}
            branches={branches}
            onChange={setCompareBranch}
          />

          {diffPayload && (
            <div className="hidden xl:flex items-center gap-1.5 text-[10px] font-mono text-subtext1 px-2 border-l border-surface0">
              <span
                className="px-1.5 py-0.5 bg-surface0 rounded border border-surface0 text-text"
                title={`Base commit: ${diffPayload.base_commit}`}
              >
                {diffPayload.base_commit.substring(0, 7)}
              </span>
              <span className="text-subtext0">...</span>
              <span
                className="px-1.5 py-0.5 bg-surface0 rounded border border-surface0 text-blue font-semibold"
                title={`Compare commit: ${diffPayload.compare_commit}`}
              >
                {diffPayload.compare_commit.substring(0, 7)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Draggable region filler */}
      <div data-tauri-drag-region className="flex-1 h-full min-w-4" />

      {/* Right: Git Sync Toolbar, Theme Switcher & Window Controls */}
      <div className="flex items-center gap-2 h-full shrink-0">
        {currentRepo ? (
          <>
            {syncStatus && (
              <span className="text-[10px] text-subtext1 max-w-[130px] truncate animate-pulse font-mono mr-1">
                {syncStatus}
              </span>
            )}

            <div className="flex items-center bg-surface0 rounded-md border border-surface0 p-0.5">
              <button
                type="button"
                disabled={isSyncing}
                onClick={() => runSync('fetch')}
                className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-text hover:text-text hover:bg-surface1 rounded transition-colors disabled:opacity-50"
                title="git fetch --all --prune"
              >
                <RefreshCw
                  className={`w-3 h-3 ${isSyncing ? 'animate-spin text-blue' : ''}`}
                />
                <span>Fetch</span>
              </button>

              <button
                type="button"
                disabled={isSyncing}
                onClick={() => runSync('pull')}
                className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-text hover:text-text hover:bg-surface1 rounded transition-colors disabled:opacity-50"
                title="git pull"
              >
                <Download className="w-3 h-3" />
                <span>Pull</span>
              </button>

              <button
                type="button"
                disabled={isSyncing}
                onClick={() => runSync('rebase')}
                className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-text hover:text-text hover:bg-surface1 rounded transition-colors disabled:opacity-50"
                title="git rebase"
              >
                <GitMerge className="w-3 h-3" />
                <span>Rebase</span>
              </button>
            </div>

            <button
              type="button"
              onClick={refreshDiff}
              className="p-1 rounded-md bg-surface0 border border-surface0 hover:bg-surface1 text-subtext1 hover:text-blue transition-colors"
              title="Refresh MR diff & conflict simulation (Ctrl+R)"
            >
              <RotateCw className="w-3 h-3" />
            </button>
          </>
        ) : null}

        <div className="h-4 w-px bg-surface0 mx-0.5" />
        <ThemeSwitcher />
        <WindowControls />
      </div>
    </header>
  );
};
