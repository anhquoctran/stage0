import React, { useState, useRef, useEffect } from 'react';
import { clsx } from 'clsx';
import { invoke } from '@tauri-apps/api/core';
import {
  RefreshCw,
  Download,
  GitMerge,
  ChevronDown,
  FolderGit2,
  RotateCw,
  Sliders,
  Play,
  SkipForward,
  XCircle,
} from 'lucide-react';
import { WindowControls } from './WindowControls';
import { MenuBar } from './MenuBar';
import { AppLogo } from '../common/AppLogo';
import { useGitStore } from '../../store/useGitStore';

export const TopBar: React.FC = () => {
  const {
    currentRepo,
    baseBranch,
    compareBranch,
    diffPayload,
    isSyncing,
    syncStatus,
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
    /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

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
      {/* ROW 1: VSCode Style Window Titlebar & Menu Bar */}
      <div
        data-tauri-drag-region
        onDoubleClick={handleDoubleClick}
        className={clsx(
          'h-8.5 bg-crust border-b border-surface0/70 flex items-center justify-between shrink-0 select-none transition-all relative z-[100]',
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
      <div className="h-14 bg-mantle border-b border-surface0 px-3 flex items-center justify-between shrink-0 select-none relative z-20">
        {/* Left: Active Repository Indicator */}
        <div className="flex items-center gap-3">
          {currentRepo ? (
            <div
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-md border border-surface0 bg-surface0/60 max-w-[260px] shadow-xs select-none"
              title={currentRepo.local_path}
            >
              <FolderGit2 className="w-4 h-4 text-primary shrink-0" />
              <div className="text-left min-w-0">
                <span className="block font-semibold text-text truncate leading-tight text-xs">
                  {currentRepo.name}
                </span>
                <span className="block text-[10px] text-subtext1 truncate leading-tight font-mono">
                  {currentRepo.local_path}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-dashed border-surface1 bg-surface0/30 text-subtext0 text-xs select-none">
              <FolderGit2 className="w-3.5 h-3.5 text-subtext0 shrink-0" />
              <span>No Repository Opened</span>
            </div>
          )}
        </div>

        {/* Center: Repository status / Commit info */}
        {currentRepo ? (
          diffPayload && (
            <div className="hidden 2xl:flex items-center gap-1.5 text-[10px] font-mono text-subtext1 px-2.5 py-1 bg-surface0/40 rounded border border-surface0/60">
              <span className="text-subtext0 text-[9px] uppercase font-bold tracking-wider font-sans">Sandbox:</span>
              <span
                className="px-1.5 py-0.5 bg-surface0 rounded border border-surface1 text-text"
                title={`Base commit: ${diffPayload.base_commit}`}
              >
                {diffPayload.base_commit.substring(0, 7)}
              </span>
              <span className="text-subtext0">...</span>
              <span
                className="px-1.5 py-0.5 bg-surface0 rounded border border-surface1 text-brand font-semibold"
                title={`Compare commit: ${diffPayload.compare_commit}`}
              >
                {diffPayload.compare_commit.substring(0, 7)}
              </span>
            </div>
          )
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

              <div className="flex items-center bg-surface0 border border-surface0 p-0.5 gap-0.5">
                {/* FETCH BUTTON */}
                <button
                  type="button"
                  disabled={isSyncing}
                  onClick={() => runSync('fetch')}
                  className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-text hover:bg-surface1 transition-colors disabled:opacity-50 cursor-pointer"
                  title="git fetch --all --prune (Ctrl+Shift+F)"
                >
                  <RefreshCw
                    className={`w-3 h-3 ${isSyncing ? 'animate-spin text-blue' : ''}`}
                  />
                  <span>Fetch</span>
                </button>

                {/* PULL SPLIT BUTTON */}
                <div className="relative flex items-center" ref={pullMenuRef}>
                  <div className="flex items-stretch overflow-hidden">
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
                  <div className="flex items-stretch overflow-hidden">
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
                className="p-1.5 rounded bg-surface0 border border-surface0 hover:bg-surface1 text-subtext1 hover:text-text transition-colors cursor-pointer"
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
