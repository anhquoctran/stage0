import React, { useState, useRef, useEffect } from 'react';
import {
  FolderOpen,
  XCircle,
  Copy,
  ArrowUp,
  ArrowDown,
  Columns2,
  Rows2,
  List,
  FolderTree,
  SunMoon,
  RefreshCw,
  Download,
  GitMerge,
  ArrowLeftRight,
  RotateCw,
  Keyboard,
  Info,
  Power,
  Clock,
  Check,
  ChevronRight,
  Sliders,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useGitStore } from '../../store/useGitStore';
import { useThemeStore } from '../../store/useThemeStore';
import { usePreferencesStore } from '../../store/usePreferencesStore';

export const MenuBar: React.FC = () => {
  const {
    currentRepo,
    recentRepos,
    selectedFile,
    viewMode,
    fileListLayout,
    openRepoDialog,
    selectRepo,
    closeRepo,
    selectPrevFile,
    selectNextFile,
    setViewMode,
    setFileListLayout,
    swapBranches,
    refreshDiff,
    runSync,
    isSyncing,
  } = useGitStore();

  const { themeMode, toggleTheme } = useThemeStore();
  const { setIsPreferencesOpen } = usePreferencesStore();

  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [showRecentSubmenu, setShowRecentSubmenu] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);

  const menuBarRef = useRef<HTMLDivElement>(null);

  // Close menus when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
        setShowRecentSubmenu(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveMenu(null);
        setShowRecentSubmenu(false);
      } else if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        (e.key.toLowerCase() === 't' || e.code === 'KeyT')
      ) {
        e.preventDefault();
        setActiveMenu(null);
        setShowRecentSubmenu(false);
        setIsPreferencesOpen(true);
      } else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        openRepoDialog();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [openRepoDialog, setIsPreferencesOpen]);

  const handleMenuClick = (menuName: string) => {
    if (activeMenu === menuName) {
      setActiveMenu(null);
      setShowRecentSubmenu(false);
    } else {
      setActiveMenu(menuName);
      setShowRecentSubmenu(false);
    }
  };

  const handleMenuHover = (menuName: string) => {
    if (activeMenu !== null && activeMenu !== menuName) {
      setActiveMenu(menuName);
      setShowRecentSubmenu(false);
    }
  };

  const closeMenus = () => {
    setActiveMenu(null);
    setShowRecentSubmenu(false);
  };

  const handleExitApp = async () => {
    closeMenus();
    try {
      await invoke('window_close');
    } catch {
      window.close();
    }
  };

  const handleCopyPath = () => {
    if (selectedFile) {
      navigator.clipboard.writeText(selectedFile.path);
    }
    closeMenus();
  };

  return (
    <>
      <nav
        ref={menuBarRef}
        aria-label="Application menu"
        className="flex items-center h-full select-none text-xs"
      >
        {/* FILE MENU */}
        <div className="relative h-full flex items-center">
          <button
            type="button"
            onClick={() => handleMenuClick('file')}
            onMouseEnter={() => handleMenuHover('file')}
            className={`px-2.5 py-1 rounded text-xs font-normal transition-colors cursor-pointer ${
              activeMenu === 'file'
                ? 'bg-surface1 text-text'
                : 'text-subtext1 hover:text-text hover:bg-surface0'
            }`}
          >
            File
          </button>

          {activeMenu === 'file' && (
            <div className="absolute left-0 top-full mt-0.5 w-64 rounded-md shadow-2xl bg-mantle border border-surface0 py-1.5 z-50 text-xs">
              <button
                type="button"
                onClick={() => {
                  closeMenus();
                  openRepoDialog();
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                  <span>Open Repository...</span>
                </div>
                <span className="text-[10px] text-subtext0 font-mono">Ctrl+O</span>
              </button>

              {/* Recent Repos Submenu Trigger */}
              <div
                className="relative"
                onMouseEnter={() => setShowRecentSubmenu(true)}
                onMouseLeave={() => setShowRecentSubmenu(false)}
              >
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                    <span>Recent Repositories</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                </button>

                {showRecentSubmenu && (
                  <div className="absolute left-full top-0 ml-0.5 w-72 rounded-md shadow-2xl bg-mantle border border-surface0 py-1.5 z-50 text-xs max-h-72 overflow-y-auto">
                    {recentRepos.length === 0 ? (
                      <div className="px-3 py-2 text-subtext0 text-center italic">
                        No recent repositories
                      </div>
                    ) : (
                      recentRepos.map((repo) => (
                        <button
                          key={repo.id}
                          type="button"
                          onClick={() => {
                            selectRepo(repo);
                            closeMenus();
                          }}
                          className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer"
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <div className="font-medium truncate text-text">{repo.name}</div>
                            <div className="text-[10px] text-subtext0 truncate font-mono">
                              {repo.local_path}
                            </div>
                          </div>
                          {currentRepo?.id === repo.id && (
                            <Check className="w-3.5 h-3.5 text-subtext0 group-hover:text-text shrink-0" />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="my-1 border-t border-surface0" />

              <button
                type="button"
                onClick={() => {
                  closeMenus();
                  setIsPreferencesOpen(true);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Sliders className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                  <span>Preferences...</span>
                </div>
                <span className="text-[10px] text-subtext0 font-mono">Ctrl+Shift+T</span>
              </button>

              <div className="my-1 border-t border-surface0" />

              <button
                type="button"
                disabled={!currentRepo}
                onClick={() => {
                  closeRepo();
                  closeMenus();
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors disabled:opacity-40 disabled:hover:bg-transparent group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <XCircle className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                  <span>Close Repository</span>
                </div>
              </button>

              <div className="my-1 border-t border-surface0" />

              <button
                type="button"
                onClick={handleExitApp}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text hover:text-red text-left transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Power className="w-3.5 h-3.5 text-subtext0 group-hover:text-red transition-colors" />
                  <span>Exit</span>
                </div>
                <span className="text-[10px] text-subtext0 font-mono">Alt+F4</span>
              </button>
            </div>
          )}
        </div>

        {/* EDIT MENU */}
        <div className="relative h-full flex items-center">
          <button
            type="button"
            onClick={() => handleMenuClick('edit')}
            onMouseEnter={() => handleMenuHover('edit')}
            className={`px-2.5 py-1 rounded text-xs font-normal transition-colors cursor-pointer ${
              activeMenu === 'edit'
                ? 'bg-surface1 text-text'
                : 'text-subtext1 hover:text-text hover:bg-surface0'
            }`}
          >
            Edit
          </button>

          {activeMenu === 'edit' && (
            <div className="absolute left-0 top-full mt-0.5 w-60 rounded-md shadow-2xl bg-mantle border border-surface0 py-1.5 z-50 text-xs">
              <button
                type="button"
                disabled={!selectedFile}
                onClick={handleCopyPath}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors disabled:opacity-40 disabled:hover:bg-transparent group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Copy className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                  <span>Copy File Path</span>
                </div>
                <span className="text-[10px] text-subtext0 font-mono">Ctrl+C</span>
              </button>

              <div className="my-1 border-t border-surface0" />

              <button
                type="button"
                disabled={!currentRepo}
                onClick={() => {
                  selectPrevFile();
                  closeMenus();
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors disabled:opacity-40 disabled:hover:bg-transparent group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <ArrowUp className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                  <span>Previous File</span>
                </div>
                <span className="text-[10px] text-subtext0 font-mono">Up / K</span>
              </button>

              <button
                type="button"
                disabled={!currentRepo}
                onClick={() => {
                  selectNextFile();
                  closeMenus();
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors disabled:opacity-40 disabled:hover:bg-transparent group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <ArrowDown className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                  <span>Next File</span>
                </div>
                <span className="text-[10px] text-subtext0 font-mono">Down / J</span>
              </button>
            </div>
          )}
        </div>

        {/* VIEW MENU */}
        <div className="relative h-full flex items-center">
          <button
            type="button"
            onClick={() => handleMenuClick('view')}
            onMouseEnter={() => handleMenuHover('view')}
            className={`px-2.5 py-1 rounded text-xs font-normal transition-colors cursor-pointer ${
              activeMenu === 'view'
                ? 'bg-surface1 text-text'
                : 'text-subtext1 hover:text-text hover:bg-surface0'
            }`}
          >
            View
          </button>

          {activeMenu === 'view' && (
            <div className="absolute left-0 top-full mt-0.5 w-64 rounded-md shadow-2xl bg-mantle border border-surface0 py-1.5 z-50 text-xs">
              <button
                type="button"
                onClick={() => {
                  setViewMode('split');
                  closeMenus();
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Columns2 className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                  <span>Side-by-side (Split)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-subtext0 font-mono">S</span>
                  {viewMode === 'split' && <Check className="w-3.5 h-3.5 text-text" />}
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setViewMode('unified');
                  closeMenus();
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Rows2 className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                  <span>Inline (Unified)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-subtext0 font-mono">U</span>
                  {viewMode === 'unified' && <Check className="w-3.5 h-3.5 text-text" />}
                </div>
              </button>

              <div className="my-1 border-t border-surface0" />

              <button
                type="button"
                onClick={() => {
                  setFileListLayout('flat');
                  closeMenus();
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <List className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                  <span>File List: Flat Layout</span>
                </div>
                {fileListLayout === 'flat' && <Check className="w-3.5 h-3.5 text-text" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  setFileListLayout('tree');
                  closeMenus();
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <FolderTree className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                  <span>File List: Tree Layout</span>
                </div>
                {fileListLayout === 'tree' && <Check className="w-3.5 h-3.5 text-text" />}
              </button>

              <div className="my-1 border-t border-surface0" />

              <button
                type="button"
                onClick={() => {
                  toggleTheme();
                  closeMenus();
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <SunMoon className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                  <span>Toggle Theme</span>
                </div>
                <span className="text-[10px] text-subtext0 font-mono capitalize">
                  {themeMode}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* REPOSITORY MENU */}
        <div className="relative h-full flex items-center">
          <button
            type="button"
            onClick={() => handleMenuClick('repository')}
            onMouseEnter={() => handleMenuHover('repository')}
            className={`px-2.5 py-1 rounded text-xs font-normal transition-colors cursor-pointer ${
              activeMenu === 'repository'
                ? 'bg-surface1 text-text'
                : 'text-subtext1 hover:text-text hover:bg-surface0'
            }`}
          >
            Repository
          </button>

          {activeMenu === 'repository' && (
            <div className="absolute left-0 top-full mt-0.5 w-64 rounded-md shadow-2xl bg-mantle border border-surface0 py-1.5 z-50 text-xs">
              <button
                type="button"
                disabled={!currentRepo || isSyncing}
                onClick={() => {
                  runSync('fetch');
                  closeMenus();
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors disabled:opacity-40 disabled:hover:bg-transparent group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                  <span>Fetch (All &amp; Prune)</span>
                </div>
              </button>

              <button
                type="button"
                disabled={!currentRepo || isSyncing}
                onClick={() => {
                  runSync('pull');
                  closeMenus();
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors disabled:opacity-40 disabled:hover:bg-transparent group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Download className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                  <span>Pull</span>
                </div>
              </button>

              <button
                type="button"
                disabled={!currentRepo || isSyncing}
                onClick={() => {
                  runSync('rebase');
                  closeMenus();
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors disabled:opacity-40 disabled:hover:bg-transparent group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <GitMerge className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                  <span>Rebase</span>
                </div>
              </button>

              <div className="my-1 border-t border-surface0" />

              <button
                type="button"
                disabled={!currentRepo}
                onClick={() => {
                  swapBranches();
                  closeMenus();
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors disabled:opacity-40 disabled:hover:bg-transparent group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <ArrowLeftRight className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                  <span>Swap Base &amp; Compare</span>
                </div>
              </button>

              <button
                type="button"
                disabled={!currentRepo}
                onClick={() => {
                  refreshDiff();
                  closeMenus();
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors disabled:opacity-40 disabled:hover:bg-transparent group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <RotateCw className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                  <span>Refresh Diff &amp; Conflicts</span>
                </div>
                <span className="text-[10px] text-subtext0 font-mono">Ctrl+R</span>
              </button>
            </div>
          )}
        </div>

        {/* HELP MENU */}
        <div className="relative h-full flex items-center">
          <button
            type="button"
            onClick={() => handleMenuClick('help')}
            onMouseEnter={() => handleMenuHover('help')}
            className={`px-2.5 py-1 rounded text-xs font-normal transition-colors cursor-pointer ${
              activeMenu === 'help'
                ? 'bg-surface1 text-text'
                : 'text-subtext1 hover:text-text hover:bg-surface0'
            }`}
          >
            Help
          </button>

          {activeMenu === 'help' && (
            <div className="absolute left-0 top-full mt-0.5 w-60 rounded-md shadow-2xl bg-mantle border border-surface0 py-1.5 z-50 text-xs">
              <button
                type="button"
                onClick={() => {
                  closeMenus();
                  setShowShortcutsModal(true);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Keyboard className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                  <span>Keyboard Shortcuts</span>
                </div>
              </button>

              <div className="my-1 border-t border-surface0" />

              <button
                type="button"
                onClick={() => {
                  closeMenus();
                  setShowAboutModal(true);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Info className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                  <span>About Stage0</span>
                </div>
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Keyboard Shortcuts Modal */}
      {showShortcutsModal && (
        <div className="fixed inset-0 z-50 bg-crust/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-mantle border border-surface0 rounded-xl p-5 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-surface0">
              <div className="flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-subtext0" />
                <h3 className="text-sm font-bold text-text">Keyboard Shortcuts</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowShortcutsModal(false)}
                className="text-subtext0 hover:text-text p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="py-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-subtext1">Open Repository</span>
                <kbd className="px-2 py-0.5 rounded bg-surface0 text-text font-mono text-[11px] border border-surface1">Ctrl+O</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-subtext1">Refresh Virtual Diff</span>
                <kbd className="px-2 py-0.5 rounded bg-surface0 text-text font-mono text-[11px] border border-surface1">Ctrl+R</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-subtext1">Select Next File</span>
                <kbd className="px-2 py-0.5 rounded bg-surface0 text-text font-mono text-[11px] border border-surface1">Down / J</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-subtext1">Select Previous File</span>
                <kbd className="px-2 py-0.5 rounded bg-surface0 text-text font-mono text-[11px] border border-surface1">Up / K</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-subtext1">Side-by-side Split Diff</span>
                <kbd className="px-2 py-0.5 rounded bg-surface0 text-text font-mono text-[11px] border border-surface1">S</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-subtext1">Inline Unified Diff</span>
                <kbd className="px-2 py-0.5 rounded bg-surface0 text-text font-mono text-[11px] border border-surface1">U</kbd>
              </div>
            </div>

            <div className="pt-3 border-t border-surface0 text-right">
              <button
                type="button"
                onClick={() => setShowShortcutsModal(false)}
                className="px-4 py-1.5 bg-surface1 hover:bg-surface2 text-text font-semibold rounded-md text-xs cursor-pointer transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* About Modal */}
      {showAboutModal && (
        <div className="fixed inset-0 z-50 bg-crust/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-mantle border border-surface0 rounded-xl p-5 max-w-sm w-full shadow-2xl text-center animate-in zoom-in-95 duration-150">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-surface0 border border-surface1 flex items-center justify-center text-subtext0 shadow-lg">
              <img src="/app-icon.svg" className="w-10 h-10" alt="Logo" />
            </div>
            <h3 className="text-base font-bold text-text">Stage0</h3>
            <p className="text-xs font-mono text-subtext1 mb-2">v0.1.0 • Local-First Virtual MR Sandbox</p>
            <p className="text-xs text-subtext1 mb-4 leading-relaxed">
              Stage0 simulates 3-dot branch comparisons and merge conflict predictions completely in memory via <code className="text-text bg-surface0 px-1 py-0.5 rounded border border-surface1 font-mono">git merge-tree</code> with zero disk modifications.
            </p>
            <button
              type="button"
              onClick={() => setShowAboutModal(false)}
              className="px-5 py-1.5 bg-surface1 hover:bg-surface2 text-text font-medium rounded-lg text-xs transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
};
