import React, { useState, useRef, useEffect } from 'react';
import { clsx } from 'clsx';
import { invoke } from '@tauri-apps/api/core';
import {
  FolderOpen,
  Folder,
  Code2,
  Terminal,
  ArrowLeft,
  ArrowLeftRight,
  RefreshCw,
  Download,
  GitMerge,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FolderGit2,
  Clock,
  RotateCw,
  CheckCircle2,
  Trash2,
  Sliders,
  Play,
  SkipForward,
  XCircle,
} from 'lucide-react';
import { BranchSelector } from '../git/BranchSelector';
import { WindowControls } from './WindowControls';
import { MenuBar } from './MenuBar';
import { AppLogo } from '../common/AppLogo';
import { useGitStore } from '../../store/useGitStore';
import {
  openRepoInExplorer,
  openRepoInVsCode,
  openRepoInTerminal,
  getOsFileManagerName,
} from '../../utils/fileActions';

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
    setIsCloneModalOpen,
    selectRepo,
    removeRecentRepo,
    clearRecentRepos,
    setBaseBranch,
    setCompareBranch,
    swapBranches,
    refreshDiff,
    runSync,
    setIsPullFromOpen,
    setIsRebaseFromOpen,
    isRebasing,
    showToast,
  } = useGitStore();

  const [isRecentOpen, setIsRecentOpen] = useState(false);
  const [showOpenInSubmenu, setShowOpenInSubmenu] = useState(false);
  const [isPullMenuOpen, setIsPullMenuOpen] = useState(false);
  const [isRebaseMenuOpen, setIsRebaseMenuOpen] = useState(false);

  const fileManagerName = getOsFileManagerName();

  const recentDropdownRef = useRef<HTMLDivElement>(null);
  const pullMenuRef = useRef<HTMLDivElement>(null);
  const rebaseMenuRef = useRef<HTMLDivElement>(null);

  const handleOpenRepoIn = async (target: 'explorer' | 'vscode' | 'terminal') => {
    if (!currentRepo) return;
    try {
      if (target === 'explorer') {
        await openRepoInExplorer(currentRepo.local_path);
        showToast(`Opened repository in ${fileManagerName}`);
      } else if (target === 'vscode') {
        await openRepoInVsCode(currentRepo.local_path);
        showToast('Opened repository in VS Code');
      } else if (target === 'terminal') {
        await openRepoInTerminal(currentRepo.local_path);
        showToast('Opened repository in Terminal');
      }
    } catch (err) {
      showToast(`Failed to open: ${err}`);
    }
  };

  const isMac =
    typeof navigator !== 'undefined' &&
    /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        recentDropdownRef.current &&
        !recentDropdownRef.current.contains(target)
      ) {
        setIsRecentOpen(false);
        setShowOpenInSubmenu(false);
      }
      if (
        pullMenuRef.current &&
        !pullMenuRef.current.contains(target)
      ) {
        setIsPullMenuOpen(false);
      }
      if (
        rebaseMenuRef.current &&
        !rebaseMenuRef.current.contains(target)
      ) {
        setIsRebaseMenuOpen(false);
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
    <header className="flex flex-col shrink-0 select-none z-30">
      {/* ROW 1: VSCode Style Window Titlebar & Menu Bar */}
      <div
        data-tauri-drag-region
        onDoubleClick={handleDoubleClick}
        className={clsx(
          'h-8.5 bg-crust border-b border-surface0/70 flex items-center justify-between shrink-0 select-none transition-all',
          isMac ? 'pl-[76px] pr-2' : 'pl-2.5 pr-0'
        )}
      >
        {/* Left: Brand Icon + Stage0 + VSCode Menu Bar */}
        <div className="flex items-center gap-2 h-full">
          <div
            data-tauri-drag-region
            className="flex items-center gap-1.5 pr-2.5 border-r border-surface0/80 cursor-default"
          >
            <AppLogo size="sm" />
            <span className="text-xs font-bold tracking-tight text-text">Stage0</span>
          </div>

          <MenuBar />
        </div>

        {/* Center: Draggable Window Document Title */}
        <div
          data-tauri-drag-region
          className="flex-1 h-full flex items-center justify-center min-w-8 overflow-hidden px-4"
        >
          <span
            data-tauri-drag-region
            className="text-[11px] font-mono text-subtext0/70 truncate pointer-events-none"
          >
            {currentRepo
              ? `${currentRepo.name} — [${compareBranch || '...'} → ${baseBranch || '...'}]`
              : 'Stage0 — Virtual MR Sandbox'}
          </span>
        </div>

        {/* Right: Window Controls */}
        <div className="flex items-center h-full shrink-0">
          <WindowControls />
        </div>
      </div>

      {/* ROW 2: Git Workspace Action Toolbar */}
      <div className="h-14 bg-mantle border-b border-surface0 px-3 flex items-center justify-between shrink-0 select-none z-20">
        {/* Left: Repository Dropdown Pill (GitHub Desktop / Fork style) */}
        <div className="flex items-center gap-3">
          <div className="relative" ref={recentDropdownRef}>
            <div className="flex items-stretch rounded-md border border-surface0 bg-surface0 overflow-hidden hover:border-surface2 transition-colors shadow-xs">
              <button
                type="button"
                onClick={openRepoDialog}
                className="flex items-center gap-2 px-2.5 py-1 text-xs text-text hover:bg-surface1 transition-colors cursor-pointer"
                title={currentRepo?.local_path || 'Open Local Git Repository'}
              >
                <FolderGit2 className="w-3.5 h-3.5 text-subtext1 shrink-0" />
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
                className="flex items-center justify-center px-2 border-l border-surface0 text-subtext1 hover:text-text hover:bg-surface1 transition-colors cursor-pointer"
                title="Recent repositories"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>

            {isRecentOpen && (
              <div className="absolute left-0 mt-1.5 w-80 rounded-md shadow-2xl bg-mantle border border-surface0 z-50 py-1 animate-in fade-in duration-100">
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-subtext1 flex items-center justify-between bg-base border-b border-surface0">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3" />
                    <span>Recent Repositories</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-subtext0 font-mono">
                      {recentRepos.length}
                    </span>
                    {recentRepos.length > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          clearRecentRepos();
                        }}
                        className="text-[10px] text-subtext0 hover:text-red transition-colors cursor-pointer"
                        title="Clear all recent repositories"
                      >
                        clear
                      </button>
                    )}
                  </div>
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
                          <FolderOpen className="w-3.5 h-3.5 text-subtext1 group-hover:text-text shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-text truncate">
                              {repo.name}
                            </div>
                            <div className="text-[10px] text-subtext1 truncate font-mono">
                              {repo.local_path}
                            </div>
                          </div>
                          {currentRepo?.id === repo.id && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-subtext0 shrink-0 ml-1" />
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeRecentRepo(repo.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-surface1 text-subtext0 hover:text-text transition-all shrink-0 ml-1.5 cursor-pointer"
                          title="Remove from recents"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <div className="p-1 border-t border-surface0 bg-base space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsRecentOpen(false);
                      openRepoDialog();
                    }}
                    className="w-full text-left px-2.5 py-1.5 text-xs text-text hover:bg-surface0 rounded flex items-center gap-2 font-medium cursor-pointer"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-subtext1" />
                    <span>Open from Disk...</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsRecentOpen(false);
                      setIsCloneModalOpen(true);
                    }}
                    className="w-full text-left px-2.5 py-1.5 text-xs text-text hover:bg-surface0 rounded flex items-center gap-2 font-medium cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-subtext1" />
                    <span>Clone Repository...</span>
                  </button>
                </div>

                {currentRepo && (
                  <div className="p-1 border-t border-surface0 bg-base">
                    <div
                      className="relative"
                      onMouseEnter={() => setShowOpenInSubmenu(true)}
                      onMouseLeave={() => setShowOpenInSubmenu(false)}
                    >
                      <button
                        type="button"
                        className="w-full text-left px-2.5 py-1.5 text-xs text-text hover:bg-surface0 rounded flex items-center justify-between font-medium cursor-pointer group"
                      >
                        <div className="flex items-center gap-2">
                          <ExternalLink className="w-3.5 h-3.5 text-subtext1 group-hover:text-text transition-colors" />
                          <span>Open in</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                      </button>

                      {showOpenInSubmenu && (
                        <div className="absolute left-full top-0 ml-1 w-60 rounded-md shadow-2xl bg-mantle border border-surface0 py-1 z-50 text-xs">
                          <button
                            type="button"
                            onClick={() => {
                              setIsRecentOpen(false);
                              setShowOpenInSubmenu(false);
                              handleOpenRepoIn('terminal');
                            }}
                            className="w-full text-left px-3 py-1.5 text-xs text-text hover:bg-surface0 flex items-center justify-between font-medium cursor-pointer group"
                          >
                            <div className="flex items-center gap-2">
                              <Terminal className="w-3.5 h-3.5 text-subtext1 group-hover:text-text transition-colors" />
                              <span>Terminal</span>
                            </div>
                            <span className="text-[10px] text-subtext0 font-mono">Alt+Shift+T</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setIsRecentOpen(false);
                              setShowOpenInSubmenu(false);
                              handleOpenRepoIn('vscode');
                            }}
                            className="w-full text-left px-3 py-1.5 text-xs text-text hover:bg-surface0 flex items-center justify-between font-medium cursor-pointer group"
                          >
                            <div className="flex items-center gap-2">
                              <Code2 className="w-3.5 h-3.5 text-subtext1 group-hover:text-text transition-colors" />
                              <span>Visual Studio Code</span>
                            </div>
                            <span className="text-[10px] text-subtext0 font-mono">Alt+Shift+V</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setIsRecentOpen(false);
                              setShowOpenInSubmenu(false);
                              handleOpenRepoIn('explorer');
                            }}
                            className="w-full text-left px-3 py-1.5 text-xs text-text hover:bg-surface0 flex items-center justify-between font-medium cursor-pointer group"
                          >
                            <div className="flex items-center gap-2">
                              <Folder className="w-3.5 h-3.5 text-subtext1 group-hover:text-text transition-colors" />
                              <span>{fileManagerName}</span>
                            </div>
                            <span className="text-[10px] text-subtext0 font-mono">Alt+Shift+E</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Center: Branch Merge Sandbox Comparison */}
        {currentRepo ? (
          <div className="flex items-center gap-1.5 p-1 shadow-inner shrink-0">
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
                className="p-1.5 rounded-md bg-surface0 border border-surface0 hover:bg-surface1 text-subtext1 hover:text-blue transition-all hover:rotate-180 duration-200 cursor-pointer"
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
        ) : (
          <div className="text-xs text-subtext0 italic">
            Select or open a repository to start virtual 3-dot branch comparison
          </div>
        )}

        {/* Right: Git Sync Toolbar */}
        <div className="flex items-center gap-2 shrink-0">
          {currentRepo && (
            <>
              {syncStatus && (
                <span className="text-[10px] text-subtext1 max-w-[130px] truncate animate-pulse font-mono mr-1">
                  {syncStatus}
                </span>
              )}

              <div className="flex items-center bg-surface0 rounded-md border border-surface0 p-0.5 gap-0.5">
                {/* FETCH BUTTON */}
                <button
                  type="button"
                  disabled={isSyncing}
                  onClick={() => runSync('fetch')}
                  className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-text hover:bg-surface1 rounded transition-colors disabled:opacity-50 cursor-pointer"
                  title="git fetch --all --prune (Ctrl+Shift+F)"
                >
                  <RefreshCw
                    className={`w-3 h-3 ${isSyncing ? 'animate-spin text-blue' : ''}`}
                  />
                  <span>Fetch</span>
                </button>

                {/* PULL SPLIT BUTTON */}
                <div className="relative flex items-center" ref={pullMenuRef}>
                  <div className="flex items-stretch rounded overflow-hidden">
                    <button
                      type="button"
                      disabled={isSyncing}
                      onClick={() => runSync('pull')}
                      className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-text hover:bg-surface1 transition-colors disabled:opacity-50 cursor-pointer"
                      title="Pull (Ctrl+Shift+P)"
                    >
                      <Download className="w-3 h-3" />
                      <span>Pull</span>
                    </button>
                    <button
                      type="button"
                      disabled={isSyncing}
                      onClick={() => {
                        setIsPullMenuOpen((v) => !v);
                        setIsRebaseMenuOpen(false);
                      }}
                      className="flex items-center justify-center px-1.5 text-subtext1 hover:text-text hover:bg-surface1 border-l border-surface1 transition-colors cursor-pointer"
                      title="Pull options (Ctrl+Alt+P)"
                    >
                      <ChevronDown className="w-2.5 h-2.5" />
                    </button>
                  </div>

                  {isPullMenuOpen && (
                    <div className="absolute right-0 top-full mt-1.5 w-56 shadow-2xl bg-mantle border border-surface0 py-1 z-50 animate-in fade-in duration-100">
                      <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-subtext0 border-b border-surface0/70 mb-1">
                        Pull Options
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIsPullMenuOpen(false);
                          runSync('pull');
                        }}
                        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-xs text-text text-left transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center gap-2">
                          <Download className="w-3.5 h-3.5 text-subtext1 group-hover:text-text" />
                          <span>Pull</span>
                        </div>
                        <span className="text-[10px] text-subtext0 font-mono">Ctrl+Shift+P</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsPullMenuOpen(false);
                          setIsPullFromOpen(true);
                        }}
                        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-xs text-text text-left transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center gap-2">
                          <Sliders className="w-3.5 h-3.5 text-subtext1 group-hover:text-text" />
                          <span>Pull from...</span>
                        </div>
                        <span className="text-[10px] text-subtext0 font-mono">Ctrl+Alt+P</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* REBASE SPLIT BUTTON */}
                <div className="relative flex items-center" ref={rebaseMenuRef}>
                  <div className="flex items-stretch rounded overflow-hidden">
                    <button
                      type="button"
                      disabled={isSyncing}
                      onClick={() => runSync('rebase')}
                      className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-text hover:bg-surface1 transition-colors disabled:opacity-50 cursor-pointer"
                      title="Rebase (Ctrl+Shift+R)"
                    >
                      <GitMerge className="w-3 h-3" />
                      <span>Rebase</span>
                    </button>
                    <button
                      type="button"
                      disabled={isSyncing}
                      onClick={() => {
                        setIsRebaseMenuOpen((v) => !v);
                        setIsPullMenuOpen(false);
                      }}
                      className="flex items-center justify-center px-1.5 text-subtext1 hover:text-text hover:bg-surface1 border-l border-surface1 transition-colors cursor-pointer"
                      title="Rebase options (Ctrl+Alt+R)"
                    >
                      <ChevronDown className="w-2.5 h-2.5" />
                    </button>
                  </div>

                  {isRebaseMenuOpen && (
                    <div className="absolute right-0 top-full mt-1.5 w-60 shadow-2xl bg-mantle border border-surface0 py-1 z-50 animate-in fade-in duration-100">
                      <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-subtext0 border-b border-surface0/70 mb-1">
                        Rebase Options
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIsRebaseMenuOpen(false);
                          runSync('rebase');
                        }}
                        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-xs text-text text-left transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center gap-2">
                          <GitMerge className="w-3.5 h-3.5 text-subtext1 group-hover:text-text" />
                          <span>Rebase</span>
                        </div>
                        <span className="text-[10px] text-subtext0 font-mono">Ctrl+Shift+R</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsRebaseMenuOpen(false);
                          setIsRebaseFromOpen(true);
                        }}
                        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-xs text-text text-left transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center gap-2">
                          <Sliders className="w-3.5 h-3.5 text-subtext1 group-hover:text-text" />
                          <span>Rebase from...</span>
                        </div>
                        <span className="text-[10px] text-subtext0 font-mono">Ctrl+Alt+R</span>
                      </button>

                      <div className="my-1 border-t border-surface0" />

                      <div className="px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-subtext0">
                        In-Progress Actions
                      </div>

                      <button
                        type="button"
                        disabled={isSyncing || !isRebasing}
                        onClick={() => {
                          setIsRebaseMenuOpen(false);
                          runSync('rebase_continue');
                        }}
                        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-xs text-text text-left transition-colors cursor-pointer group disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                      >
                        <div className="flex items-center gap-2">
                          <Play className="w-3.5 h-3.5 text-subtext1 group-hover:text-text" />
                          <span>Continue Rebase</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        disabled={isSyncing || !isRebasing}
                        onClick={() => {
                          setIsRebaseMenuOpen(false);
                          runSync('rebase_skip');
                        }}
                        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-xs text-text text-left transition-colors cursor-pointer group disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                      >
                        <div className="flex items-center gap-2">
                          <SkipForward className="w-3.5 h-3.5 text-subtext1 group-hover:text-text" />
                          <span>Skip Commit</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        disabled={isSyncing || !isRebasing}
                        onClick={() => {
                          setIsRebaseMenuOpen(false);
                          runSync('rebase_abort');
                        }}
                        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-xs text-text text-left transition-colors cursor-pointer group disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                      >
                        <div className="flex items-center gap-2">
                          <XCircle className="w-3.5 h-3.5 text-subtext1 group-hover:text-text" />
                          <span>Abort Rebase</span>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={refreshDiff}
                className="p-1.5 rounded-md bg-surface0 border border-surface0 hover:bg-surface1 text-subtext1 hover:text-text transition-colors cursor-pointer"
                title="Refresh MR diff & conflict simulation (Ctrl+R)"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
