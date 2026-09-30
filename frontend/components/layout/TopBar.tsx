import React, { useState, useRef, useEffect } from 'react';
import { clsx } from 'clsx';
import { invoke } from '@tauri-apps/api/core';
import {
  RefreshCw,
  Download,
  DownloadCloud,
  GitMerge,
  GitBranch,
  ChevronDown,
  FolderGit2,
  FolderCog,
  RotateCw,
  Play,
  SkipForward,
  Undo2,
} from '@/components/common/icons';
import { WindowControls } from './WindowControls';
import { MenuBar } from './MenuBar';
import { AppLogo } from '../common/AppLogo';
import { useGitStore } from '../../store/useGitStore';
import { useVirtualMrStore } from '../../store/useVirtualMrStore';
import { formatShortcutText } from '../../utils/shortcuts';

export const TopBar: React.FC = () => {
  const { openRepoSettings } = useVirtualMrStore();
  const {
    currentRepo,
    baseBranch,
    compareBranch,
    isSyncing,
    refreshDiff,
    runSync,
    setIsPullFromOpen,
    setIsRebaseFromOpen,
    isRebasing,
  } = useGitStore();

  const [isPullMenuOpen, setIsPullMenuOpen] = useState(false);
  const [isRebaseMenuOpen, setIsRebaseMenuOpen] = useState(false);

  const pullMenuRef = useRef<HTMLDivElement>(null);
  const rebaseMenuRef = useRef<HTMLDivElement>(null);

  const isMac =
    typeof navigator !== 'undefined' &&
    (/Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ||
      (typeof window !== 'undefined' && window.location.search.includes('platform=mac')));
  const shortcut = (value: string) => formatShortcutText(value, isMac);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
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
    <header className="flex flex-col shrink-0 select-none">
      {/* ROW 1: Window Titlebar & Controls */}
      <div
        data-tauri-drag-region
        onDoubleClick={handleDoubleClick}
        className={clsx(
          'h-8.5 bg-crust border-b border-surface0/70 flex items-center justify-between shrink-0 select-none transition-all relative z-[100]',
          isMac ? 'px-3' : 'pl-2.5 pr-0'
        )}
      >
        {isMac ? (
          <>
            {/* Mounted for shortcuts & macOS native system menu events */}
            <MenuBar hidden />

            {/* Reserve the native traffic-light area; the controls are rendered by macOS. */}
            <div
              data-tauri-drag-region
              aria-hidden="true"
              className="w-20 h-full shrink-0"
            />

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

            {/* Right: Drag region spacer to balance left controls and keep title centered */}
            <div data-tauri-drag-region className="w-16 h-full shrink-0 pointer-events-none" />
          </>
        ) : (
          <>
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
              <WindowControls style="windows" />
            </div>
          </>
        )}
      </div>

      {/* ROW 2: Git Workspace Action Toolbar */}
      <div className="h-16 bg-mantle border-b border-surface0 px-3.5 flex items-center justify-between shrink-0 select-none relative z-40">
        {/* Left Section: Active Repository + SourceTree Action Ribbon */}
        <div className="flex items-center gap-2 min-w-0">
          {/* Active Repository Indicator */}
          {currentRepo ? (
            <div
              className="flex items-center gap-3 px-3.5 h-12 bg-surface0 text-left max-w-[260px] select-none shrink-0 rounded"
              title={currentRepo.local_path}
            >
              <FolderGit2 className="w-5 h-5 text-primary shrink-0" />
              <div className="min-w-0">
                <span className="block font-semibold text-text truncate leading-tight text-xs">
                  {currentRepo.name}
                </span>
                <span className="block text-[10px] text-subtext0 truncate leading-tight font-mono">
                  {currentRepo.local_path}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 px-3.5 h-12 bg-surface0 text-subtext0 text-xs select-none shrink-0 rounded">
              <FolderGit2 className="w-4 h-4 text-subtext0 shrink-0" />
              <span>No Repository Opened</span>
            </div>
          )}

          {currentRepo ? (
            <>
              {/* Divider between Repo and Action Ribbon */}
              <div className="h-8 w-px bg-surface0 mx-1.5 shrink-0" />

              {/* SourceTree Action Toolbar */}
              <div className="flex items-center gap-1.5 shrink-0">
                {/* FETCH BUTTON */}
                <button
                  type="button"
                  disabled={isSyncing}
                  onClick={() => runSync('fetch')}
                  className="h-12 min-w-[58px] px-3 flex flex-col items-center justify-center rounded hover:bg-surface0 text-subtext1 hover:text-text transition-colors disabled:opacity-40 cursor-pointer group"
                  title={shortcut('git fetch --all --prune (Ctrl+Shift+F)')}
                >
                  <RefreshCw
                    className={`w-5 h-5 text-current shrink-0 transition-colors ${isSyncing ? 'animate-spin' : ''}`}
                  />
                  <span className="text-[11px] font-medium leading-none mt-1.5 tracking-tight transition-colors">
                    Fetch
                  </span>
                </button>

                {/* PULL SPLIT BUTTON */}
                <div
                  className={`relative flex items-stretch rounded transition-colors cursor-pointer ${
                    isPullMenuOpen
                      ? 'bg-surface0 text-primary'
                      : 'text-subtext1 hover:bg-surface0 hover:text-text'
                  }`}
                  ref={pullMenuRef}
                >
                  <button
                    type="button"
                    disabled={isSyncing}
                    onClick={() => runSync('pull')}
                    className="h-12 px-3 flex flex-col items-center justify-center transition-colors disabled:opacity-40 cursor-pointer min-w-[54px]"
                    title={shortcut('Pull (Ctrl+Shift+P)')}
                  >
                    <Download className="w-5 h-5 text-current shrink-0 transition-colors" />
                    <span className="text-[11px] font-medium leading-none mt-1.5 tracking-tight transition-colors">
                      Pull
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={isSyncing}
                    onClick={() => {
                      setIsPullMenuOpen((v) => !v);
                      setIsRebaseMenuOpen(false);
                    }}
                    className="flex items-center justify-center px-1.5 h-12 transition-colors cursor-pointer"
                    title={shortcut('Pull options (Ctrl+Alt+P)')}
                  >
                    <ChevronDown className="w-3.5 h-3.5 text-current transition-colors" />
                  </button>

                  {isPullMenuOpen && (
                    <div className="absolute left-0 top-full mt-1.5 w-56 shadow-2xl bg-mantle border border-surface0 py-1 z-50 animate-in fade-in duration-100 rounded">
                      <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-subtext0 border-b border-surface0 mb-1">
                        Pull Options
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIsPullMenuOpen(false);
                          runSync('pull');
                        }}
                        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface0 text-xs text-text hover:text-primary text-left transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center gap-2">
                          <Download className="w-3.5 h-3.5 text-current transition-colors" />
                          <span>Pull</span>
                        </div>
                        <span className="text-[10px] text-subtext0 font-mono">{shortcut('Ctrl+Shift+P')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsPullMenuOpen(false);
                          setIsPullFromOpen(true);
                        }}
                        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface0 text-xs text-text hover:text-primary text-left transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center gap-2">
                          <DownloadCloud className="w-3.5 h-3.5 text-current transition-colors" />
                          <span>Pull from...</span>
                        </div>
                        <span className="text-[10px] text-subtext0 font-mono">{shortcut('Ctrl+Alt+P')}</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* REBASE SPLIT BUTTON */}
                <div
                  className={`relative flex items-stretch rounded transition-colors cursor-pointer ${
                    isRebaseMenuOpen
                      ? 'bg-surface0 text-primary'
                      : 'text-subtext1 hover:bg-surface0 hover:text-text'
                  }`}
                  ref={rebaseMenuRef}
                >
                  <button
                    type="button"
                    disabled={isSyncing}
                    onClick={() => runSync('rebase')}
                    className="h-12 px-3 flex flex-col items-center justify-center transition-colors disabled:opacity-40 cursor-pointer min-w-[58px]"
                    title={shortcut('Rebase (Ctrl+Shift+R)')}
                  >
                    <GitMerge className="w-5 h-5 text-current shrink-0 transition-colors" />
                    <span className="text-[11px] font-medium leading-none mt-1.5 tracking-tight transition-colors">
                      Rebase
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={isSyncing}
                    onClick={() => {
                      setIsRebaseMenuOpen((v) => !v);
                      setIsPullMenuOpen(false);
                    }}
                    className="flex items-center justify-center px-1.5 h-12 transition-colors cursor-pointer"
                    title={shortcut('Rebase options (Ctrl+Alt+R)')}
                  >
                    <ChevronDown className="w-3.5 h-3.5 text-current transition-colors" />
                  </button>

                  {isRebaseMenuOpen && (
                    <div className="absolute left-0 top-full mt-1.5 w-60 shadow-2xl bg-mantle border border-surface0 py-1 z-50 animate-in fade-in duration-100 rounded">
                      <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-subtext0 border-b border-surface0 mb-1">
                        Rebase Options
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIsRebaseMenuOpen(false);
                          runSync('rebase');
                        }}
                        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface0 text-xs text-text hover:text-primary text-left transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center gap-2">
                          <GitMerge className="w-3.5 h-3.5 text-current transition-colors" />
                          <span>Rebase</span>
                        </div>
                        <span className="text-[10px] text-subtext0 font-mono">{shortcut('Ctrl+Shift+R')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsRebaseMenuOpen(false);
                          setIsRebaseFromOpen(true);
                        }}
                        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface0 text-xs text-text hover:text-primary text-left transition-colors cursor-pointer group"
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
                          setIsRebaseMenuOpen(false);
                          runSync('rebase_continue');
                        }}
                        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface0 text-xs text-text hover:text-primary text-left transition-colors cursor-pointer group disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed"
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
                          setIsRebaseMenuOpen(false);
                          runSync('rebase_skip');
                        }}
                        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface0 text-xs text-text hover:text-primary text-left transition-colors cursor-pointer group disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed"
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
                          setIsRebaseMenuOpen(false);
                          runSync('rebase_abort');
                        }}
                        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface0 text-xs text-text hover:text-primary text-left transition-colors cursor-pointer group disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                      >
                        <div className="flex items-center gap-2">
                          <Undo2 className="w-3.5 h-3.5 text-current transition-colors" />
                          <span>Abort Rebase</span>
                        </div>
                      </button>
                    </div>
                  )}
                </div>

                {/* REFRESH BUTTON */}
                <button
                  type="button"
                  disabled={isSyncing}
                  onClick={refreshDiff}
                  className="h-12 min-w-[58px] px-3 flex flex-col items-center justify-center rounded hover:bg-surface0 text-subtext1 hover:text-text transition-colors disabled:opacity-40 cursor-pointer group"
                  title={shortcut('Refresh MR diff & conflict simulation (Ctrl+R)')}
                >
                  <RotateCw className="w-5 h-5 text-current shrink-0 transition-colors" />
                  <span className="text-[11px] font-medium leading-none mt-1.5 tracking-tight transition-colors">
                    Refresh
                  </span>
                </button>

                {/* REPO SETTINGS BUTTON */}
                <button
                  type="button"
                  disabled={!currentRepo}
                  onClick={() => openRepoSettings('remotes')}
                  className="h-12 min-w-[68px] px-2.5 flex flex-col items-center justify-center rounded hover:bg-surface0 text-subtext1 hover:text-text transition-colors disabled:opacity-40 cursor-pointer group"
                  title={shortcut('Repository Settings (Ctrl+Alt+S)')}
                >
                  <FolderCog className="w-5 h-5 text-current shrink-0 transition-colors" />
                  <span className="text-[11px] font-medium leading-none mt-1.5 tracking-tight transition-colors whitespace-nowrap">
                    Repo Settings
                  </span>
                </button>
              </div>
            </>
          ) : (
            <div className="text-xs text-subtext0 italic">
              Select or open a repository to start virtual 3-dot branch comparison
            </div>
          )}
        </div>

        {/* Right Section: Sync Status & Rebase in-progress strip */}
        <div className="flex items-center gap-2.5 shrink-0">
          {currentRepo && (
            <>
              {isRebasing && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-950 text-white text-xs rounded">
                  <span className="text-xs font-semibold text-amber-200 uppercase tracking-wider mr-1">
                    Rebasing:
                  </span>
                  <button
                    type="button"
                    disabled={isSyncing}
                    onClick={() => runSync('rebase_continue')}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-900 hover:bg-emerald-800 text-white text-xs font-medium transition-colors cursor-pointer rounded"
                    title="Continue rebase after resolving conflicts"
                  >
                    <Play className="w-3.5 h-3.5 text-white" />
                    <span>Continue</span>
                  </button>
                  <button
                    type="button"
                    disabled={isSyncing}
                    onClick={() => runSync('rebase_skip')}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-surface1 hover:bg-surface2 text-white text-xs font-medium transition-colors cursor-pointer rounded"
                    title="Skip this commit"
                  >
                    <SkipForward className="w-3.5 h-3.5 text-white" />
                    <span>Skip</span>
                  </button>
                  <button
                    type="button"
                    disabled={isSyncing}
                    onClick={() => runSync('rebase_abort')}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-red-900 hover:bg-red-800 text-white text-xs font-medium transition-colors cursor-pointer rounded"
                    title="Abort rebase and restore original state"
                  >
                    <Undo2 className="w-3.5 h-3.5 text-white" />
                    <span>Abort</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
};
