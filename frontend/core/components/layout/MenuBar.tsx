import React, { useState, useRef, useEffect } from 'react';
import {
  FolderOpen,
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
  DownloadCloud,
  GitMerge,
  GitBranch,
  ArrowLeftRight,
  GitCompare,
  Keyboard,
  Info,
  Power,
  Clock,
  Check,
  ChevronRight,
  Cog,
  Play,
  SkipForward,
  Undo2,
  FileText,
  Globe,
  ExternalLink,
  History,
  GitCommit,
  Terminal,
  Code2,
  Folder,
  FolderDown,
  FolderX,
  FolderCog,
  Trash2,
  GitPullRequest,
  HeartPulse,
  X,
} from '@/common/components/icons';
import {
  revealInOs,
  getAbsoluteFilePath,
  buildRemoteFileUrl,
  openRepoInTerminal,
  openRepoInVsCode,
  openRepoInExplorer,
  getOsFileManagerName,
} from '../../../features/git/utils/fileActions';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useGitStore } from '../../../features/git/store/useGitStore';
import { useThemeStore } from '../../store/useThemeStore';
import { usePreferencesStore } from '../../../features/preferences/store/usePreferencesStore';
import { useVirtualMrStore } from '../../../features/virtual-mr/store/useVirtualMrStore';
import { AboutModal } from '../../../features/about/components/AboutModal';
import { formatShortcutText } from '../../../common/utils/shortcuts';
import { usePerformanceMonitorStore } from '../../../features/performance/store/usePerformanceMonitorStore';

export interface MenuBarProps {
  hidden?: boolean;
}

export const MenuBar: React.FC<MenuBarProps> = ({ hidden = false }) => {
  const { openRepoSettings, openNewMrDraft } = useVirtualMrStore();
  const {
    currentRepo,
    recentRepos,
    selectedFile,
    viewMode,
    fileListLayout,
    openRepoDialog,
    setIsCloneModalOpen,
    selectRepo,
    clearRecentRepos,
    removeRecentRepo,
    closeRepo,
    selectPrevFile,
    selectNextFile,
    setViewMode,
    setFileListLayout,
    swapBranches,
    refreshDiff,
    runSync,
    isSyncing,
    setIsPullFromOpen,
    setIsRebaseFromOpen,
    remoteUrl,
    compareBranch,
    showToast,
    setIsRemoteUrlFromOpen,
    setTargetFileForUrl,
    isRebasing,
    fileViewTab,
    setFileViewTab,
    toggleFileBlame,
    fetchFileBlame,
  } = useGitStore();

  const { themeMode, toggleTheme } = useThemeStore();
  const { setIsPreferencesOpen, showInlineBlame, toggleInlineBlame } = usePreferencesStore();
  const { isEnabled: isPerformanceMonitorEnabled, toggle: togglePerformanceMonitor } = usePerformanceMonitorStore();

  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [showRecentSubmenu, setShowRecentSubmenu] = useState(false);
  const [showOpenInSubmenu, setShowOpenInSubmenu] = useState(false);
  const [showPerformanceSubmenu, setShowPerformanceSubmenu] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);

  const fileManagerName = getOsFileManagerName();

  const isMac =
    typeof navigator !== 'undefined' &&
    /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const shortcut = (value: string) => formatShortcutText(value, isMac);

  const menuBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentRepo) return;

    setActiveMenu((menu) => (menu === 'repository' || menu === 'edit' ? null : menu));
    setShowOpenInSubmenu(false);
  }, [currentRepo]);

  // Close menus when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
        setShowRecentSubmenu(false);
        setShowOpenInSubmenu(false);
        setShowPerformanceSubmenu(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveMenu(null);
        setShowRecentSubmenu(false);
        setShowOpenInSubmenu(false);
        setShowPerformanceSubmenu(false);
        setShowShortcutsModal(false);
      } else if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === ',' || (e.shiftKey && (e.key.toLowerCase() === 't' || e.code === 'KeyT')))
      ) {
        e.preventDefault();
        // The native macOS menu owns Cmd+,; keep the custom Shift+T alias here.
        if (!(isMac && e.key === ',')) {
          setActiveMenu(null);
          setShowRecentSubmenu(false);
          setShowOpenInSubmenu(false);
          setIsPreferencesOpen(true);
        }
      } else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        if (!isMac) openRepoDialog();
      } else if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        (e.key.toLowerCase() === 'n' || e.code === 'KeyN')
      ) {
        e.preventDefault();
        // macOS routes this accelerator through the native application menu.
        if (!isMac) void invoke('create_new_window');
      } else if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        (e.key.toLowerCase() === 'o' || e.code === 'KeyO')
      ) {
        e.preventDefault();
        if (!isMac) setIsCloneModalOpen(true);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMac, openRepoDialog, setIsPreferencesOpen, setIsCloneModalOpen]);

  // Listen to native macOS menu events from Tauri
  useEffect(() => {
    let isDisposed = false;
    let unlistenFn: (() => void) | undefined;

    listen<string>('menu-action', (event) => {
      if (isDisposed) return;

      if (event.payload.startsWith('recent_repo_')) {
        const repositoryId = event.payload.slice('recent_repo_'.length);
        const repository = useGitStore
          .getState()
          .recentRepos.find((repo) => repo.id === repositoryId);
        if (repository) {
          void useGitStore.getState().selectRepo(repository);
        }
        return;
      }

      switch (event.payload) {
        case 'open_repo':
          openRepoDialog();
          break;
        case 'open_repo_new_window':
          openRepoDialog(true);
          break;
        case 'new_window':
          void invoke('create_new_window');
          break;
        case 'close_window':
          void invoke('window_close');
          break;
        case 'clone_repo':
          setIsCloneModalOpen(true);
          break;
        case 'close_repo':
          closeRepo();
          break;
        case 'preferences':
          setIsPreferencesOpen(true);
          break;
        case 'new_mr':
          openNewMrDraft();
          break;
        case 'fetch':
          runSync('fetch');
          break;
        case 'pull':
          runSync('pull');
          break;
        case 'rebase':
          runSync('rebase');
          break;
        case 'repo_settings':
          openRepoSettings('remotes');
          break;
        case 'view_split':
          setViewMode('split');
          break;
        case 'view_unified':
          setViewMode('unified');
          break;
        case 'toggle_blame':
          toggleFileBlame();
          break;
        case 'toggle_inline_blame':
          toggleInlineBlame();
          break;
        case 'toggle_perf_monitor':
          togglePerformanceMonitor();
          break;
        case 'shortcuts':
          setShowShortcutsModal(true);
          break;
        case 'open_webview_devtools':
          void invoke('open_webview_devtools');
          break;
        case 'about':
          setShowAboutModal(true);
          break;
        case 'check_updates':
          usePreferencesStore.getState().openPreferences('updates-check');
          break;
        default:
          break;
      }
    }).then((unlisten) => {
      if (isDisposed) {
        unlisten();
      } else {
        unlistenFn = unlisten;
      }
    }).catch(() => {});

    return () => {
      isDisposed = true;
      if (unlistenFn) unlistenFn();
    };
  }, [
    openRepoDialog,
    setIsCloneModalOpen,
    closeRepo,
    setIsPreferencesOpen,
    openNewMrDraft,
    runSync,
    openRepoSettings,
    setViewMode,
    toggleFileBlame,
    toggleInlineBlame,
    togglePerformanceMonitor,
  ]);

  const handleMenuClick = (menuName: string) => {
    if (activeMenu === menuName) {
      setActiveMenu(null);
      setShowRecentSubmenu(false);
      setShowOpenInSubmenu(false);
      setShowPerformanceSubmenu(false);
    } else {
      setActiveMenu(menuName);
      setShowRecentSubmenu(false);
      setShowOpenInSubmenu(false);
      setShowPerformanceSubmenu(false);
    }
  };

  const handleMenuHover = (menuName: string) => {
    if (activeMenu !== null && activeMenu !== menuName) {
      setActiveMenu(menuName);
      setShowRecentSubmenu(false);
      setShowOpenInSubmenu(false);
      setShowPerformanceSubmenu(false);
    }
  };

  const closeMenus = () => {
    setActiveMenu(null);
    setShowRecentSubmenu(false);
    setShowOpenInSubmenu(false);
    setShowPerformanceSubmenu(false);
  };

  const handleExitApp = async () => {
    closeMenus();
    try {
      await invoke('window_close');
    } catch {
      window.close();
    }
  };

  return (
    <>
      {!hidden && (
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
                  void invoke('create_new_window');
                }}
                onMouseEnter={() => setShowRecentSubmenu(false)}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer"
              >
                <Columns2 className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                <span>New Window</span>
                <span className="ml-auto text-[10px] text-subtext0 font-mono">{shortcut('Ctrl+Shift+N')}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  closeMenus();
                  openRepoDialog();
                }}
                onMouseEnter={() => {
                  setShowRecentSubmenu(false);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                  <span>Open...</span>
                </div>
                <span className="text-[10px] text-subtext0 font-mono">{shortcut('Ctrl+O')}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  closeMenus();
                  openRepoDialog(true);
                }}
                onMouseEnter={() => setShowRecentSubmenu(false)}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                  <span>Open in New Window...</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  closeMenus();
                  setIsCloneModalOpen(true);
                }}
                onMouseEnter={() => {
                  setShowRecentSubmenu(false);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <FolderDown className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                  <span>Clone...</span>
                </div>
                <span className="text-[10px] text-subtext0 font-mono">
                  {shortcut('Ctrl+Shift+O')}
                </span>
              </button>

              {/* Recent Repos Submenu Trigger */}
              <div
                className="relative"
                onMouseEnter={() => {
                  setShowRecentSubmenu(true);
                }}
                onMouseLeave={() => setShowRecentSubmenu(false)}
              >
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                    <span>Recents</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                </button>

                {showRecentSubmenu && (
                  <div className="absolute left-full top-0 ml-0.5 w-80 rounded-md shadow-2xl bg-mantle border border-surface0 py-1.5 z-50 text-xs max-h-72 overflow-y-auto">
                    {recentRepos.length === 0 ? (
                      <div className="px-3 py-2 text-subtext0 text-center italic">
                        No recent repositories
                      </div>
                    ) : (
                      recentRepos.map((repo) => (
                        <div
                          key={repo.id}
                          onClick={() => {
                            selectRepo(repo);
                            closeMenus();
                          }}
                          className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer"
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <div className="font-medium truncate text-text flex items-center gap-1.5">
                              <FolderOpen className="w-3 h-3 text-subtext0 shrink-0" />
                              <span className="truncate">{repo.name}</span>
                            </div>
                            <div className="text-[10px] text-subtext0 truncate font-mono">
                              {repo.local_path}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {currentRepo?.id === repo.id && (
                              <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeRecentRepo(repo.id);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-surface2 text-subtext0 hover:text-red transition-all cursor-pointer"
                              title="Remove from recent repositories"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                    {recentRepos.length > 0 && (
                      <>
                        <div className="my-1 border-t border-surface0" />
                        <button
                          type="button"
                          onClick={() => {
                            clearRecentRepos();
                            closeMenus();
                          }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-subtext0 hover:text-red hover:bg-surface1 text-left transition-colors group cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-subtext0 group-hover:text-red transition-colors" />
                          <span>Clear Recently Opened</span>
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="my-1 border-t border-surface0" />

              <button
                type="button"
                disabled={!currentRepo}
                onClick={() => {
                  closeRepo();
                  closeMenus();
                }}
                onMouseEnter={() => {
                  setShowRecentSubmenu(false);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors disabled:opacity-40 disabled:hover:bg-transparent group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <FolderX className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                  <span>Close Repository</span>
                </div>
              </button>

              <div className="my-1 border-t border-surface0" />

              <button
                type="button"
                onClick={() => {
                  closeMenus();
                  setIsPreferencesOpen(true);
                }}
                onMouseEnter={() => {
                  setShowRecentSubmenu(false);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Cog className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                  <span>Preferences...</span>
                </div>
                <span className="text-[10px] text-subtext0 font-mono">
                  {shortcut('Ctrl+,')}
                </span>
              </button>

              <div className="my-1 border-t border-surface0" />

              <button
                type="button"
                onClick={handleExitApp}
                onMouseEnter={() => {
                  setShowRecentSubmenu(false);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Power className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                  <span>Exit</span>
                </div>
                <span className="text-[10px] text-subtext0 font-mono">{shortcut('Alt+F4')}</span>
              </button>
            </div>
          )}
        </div>

        {/* EDIT MENU */}
        <div className="relative h-full flex items-center">
          <button
            type="button"
            disabled={!currentRepo}
            onClick={() => handleMenuClick('edit')}
            onMouseEnter={() => currentRepo && handleMenuHover('edit')}
            className={`px-2.5 py-1 rounded text-xs font-normal transition-colors ${
              !currentRepo
                ? 'text-subtext0/50 cursor-not-allowed'
                : activeMenu === 'edit'
                  ? 'bg-surface1 text-text cursor-pointer'
                  : 'text-subtext1 hover:text-text hover:bg-surface0 cursor-pointer'
            }`}
          >
            Edit
          </button>

          {currentRepo && activeMenu === 'edit' && (
            <div className="absolute left-0 top-full mt-0.5 w-68 rounded-md shadow-2xl bg-mantle border border-surface0 py-1.5 z-50 text-xs">
              <button
                type="button"
                disabled={!currentRepo || !selectedFile}
                onClick={async () => {
                  closeMenus();
                  if (currentRepo && selectedFile) {
                    try {
                      await revealInOs(currentRepo.local_path, selectedFile.path);
                      showToast('Revealed file in OS File Explorer');
                    } catch (err) {
                      showToast(`Failed to open explorer: ${err}`);
                    }
                  }
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors disabled:opacity-40 disabled:hover:bg-transparent group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                  <span>Open in {fileManagerName}</span>
                </div>
                <span className="text-[10px] text-subtext0 font-mono">{shortcut('Shift+Alt+R')}</span>
              </button>

              <button
                type="button"
                disabled={!selectedFile}
                onClick={() => {
                  closeMenus();
                  if (selectedFile) {
                    setFileViewTab('blame');
                    fetchFileBlame(selectedFile.path);
                  }
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors disabled:opacity-40 disabled:hover:bg-transparent group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <History className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                  <span>View Git Blame</span>
                </div>
                <span className="text-[10px] text-subtext0 font-mono">{shortcut('Alt+B')}</span>
              </button>

              <div className="my-1 border-t border-surface0" />

              <button
                type="button"
                disabled={!selectedFile}
                onClick={() => {
                  closeMenus();
                  if (selectedFile) {
                    navigator.clipboard.writeText(selectedFile.path);
                    showToast(`Copied relative path: ${selectedFile.path}`);
                  }
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors disabled:opacity-40 disabled:hover:bg-transparent group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Copy className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                  <span>Copy Relative Path</span>
                </div>
                <span className="text-[10px] text-subtext0 font-mono">{shortcut('Ctrl+Shift+C')}</span>
              </button>

              <button
                type="button"
                disabled={!currentRepo || !selectedFile}
                onClick={() => {
                  closeMenus();
                  if (currentRepo && selectedFile) {
                    const abs = getAbsoluteFilePath(currentRepo.local_path, selectedFile.path);
                    navigator.clipboard.writeText(abs);
                    showToast('Copied absolute path to clipboard');
                  }
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors disabled:opacity-40 disabled:hover:bg-transparent group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                  <span>Copy Absolute Path</span>
                </div>
                <span className="text-[10px] text-subtext0 font-mono">{shortcut('Shift+Alt+C')}</span>
              </button>

              <div className="my-1 border-t border-surface0" />

              <button
                type="button"
                disabled={!selectedFile}
                onClick={() => {
                  closeMenus();
                  if (selectedFile) {
                    const effectiveRemote = remoteUrl || (currentRepo ? `https://github.com/${currentRepo.name}` : '');
                    if (effectiveRemote) {
                      const ref = compareBranch || 'main';
                      const url = buildRemoteFileUrl(effectiveRemote, ref, selectedFile.path);
                      navigator.clipboard.writeText(url);
                      showToast(`Copied remote file URL (${ref})`);
                    } else {
                      showToast('No remote URL configured');
                    }
                  }
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors disabled:opacity-40 disabled:hover:bg-transparent group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                  <span>Copy Remote File URL</span>
                </div>
                <span className="text-[10px] text-subtext0 font-mono">{shortcut('Ctrl+Shift+U')}</span>
              </button>

              <button
                type="button"
                disabled={!selectedFile}
                onClick={() => {
                  closeMenus();
                  if (selectedFile) {
                    setTargetFileForUrl(selectedFile);
                    setIsRemoteUrlFromOpen(true);
                  }
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors disabled:opacity-40 disabled:hover:bg-transparent group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <ExternalLink className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                  <span>Copy Remote File URL from...</span>
                </div>
                <span className="text-[10px] text-subtext0 font-mono">{shortcut('Ctrl+Alt+U')}</span>
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
              {currentRepo && <>
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
                  toggleFileBlame();
                  closeMenus();
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <History className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                  <span>File Git Blame</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-subtext0 font-mono">{shortcut('Alt+B')}</span>
                  {fileViewTab === 'blame' && <Check className="w-3.5 h-3.5 text-text" />}
                </div>
                </button>

                <button
                type="button"
                onClick={() => {
                  toggleInlineBlame();
                  closeMenus();
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <GitCommit className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                  <span>Inline Git Blame</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-subtext0 font-mono">{shortcut('Alt+Shift+B')}</span>
                  {showInlineBlame && <Check className="w-3.5 h-3.5 text-text" />}
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
              </>}

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

              <div className="my-1 border-t border-surface0" />

              <div
                className="relative"
                onMouseEnter={() => setShowPerformanceSubmenu(true)}
                onMouseLeave={() => setShowPerformanceSubmenu(false)}
              >
                <button
                  type="button"
                  onClick={() => setShowPerformanceSubmenu((isOpen) => !isOpen)}
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer"
                  aria-haspopup="menu"
                  aria-expanded={showPerformanceSubmenu}
                >
                  <div className="flex items-center gap-2">
                    <HeartPulse className="w-3.5 h-3.5 text-primary group-hover:text-primary transition-colors" />
                    <span>Performance</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-subtext0" />
                </button>

                {showPerformanceSubmenu && (
                  <div className="absolute left-full top-0 w-60 rounded-md shadow-2xl bg-mantle border border-surface0 py-1.5 z-50 text-xs">
                    <button
                      type="button"
                      role="menuitemcheckbox"
                      aria-checked={isPerformanceMonitorEnabled}
                      onClick={() => {
                        togglePerformanceMonitor();
                        closeMenus();
                      }}
                      className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <HeartPulse className="w-3.5 h-3.5 text-primary group-hover:text-primary transition-colors" />
                        <span>Display Perf Monitor</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-subtext0 font-mono">{shortcut('Ctrl+Shift+F12')}</span>
                        {isPerformanceMonitorEnabled && <Check className="w-3.5 h-3.5 text-text" />}
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* REPOSITORY MENU */}
        <div className="relative h-full flex items-center">
          <button
            type="button"
            disabled={!currentRepo}
            onClick={() => handleMenuClick('repository')}
            onMouseEnter={() => currentRepo && handleMenuHover('repository')}
            className={`px-2.5 py-1 rounded text-xs font-normal transition-colors ${
              !currentRepo
                ? 'text-subtext0/50 cursor-not-allowed'
                : activeMenu === 'repository'
                  ? 'bg-surface1 text-text cursor-pointer'
                  : 'text-subtext1 hover:text-text hover:bg-surface0 cursor-pointer'
            }`}
          >
            Repository
          </button>

          {currentRepo && activeMenu === 'repository' && (
            <div className="absolute left-0 top-full mt-0.5 w-68 rounded-md shadow-2xl bg-mantle border border-surface0 py-1.5 z-50 text-xs">
              {/* New Virtual MR */}
              <button
                type="button"
                disabled={!currentRepo}
                onClick={() => {
                  closeMenus();
                  openNewMrDraft();
                }}
                onMouseEnter={() => setShowOpenInSubmenu(false)}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors disabled:opacity-40 disabled:hover:bg-transparent group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <GitPullRequest className="w-3.5 h-3.5 text-brand group-hover:text-brand transition-colors" />
                  <span>New Virtual MR...</span>
                </div>
                <span className="text-[10px] text-subtext0 font-mono">{shortcut('Ctrl+T')}</span>
              </button>

              <div className="my-1 border-t border-surface0" />

              <button
                type="button"
                disabled={!currentRepo || isSyncing}
                onClick={() => {
                  runSync('fetch');
                  closeMenus();
                }}
                onMouseEnter={() => setShowOpenInSubmenu(false)}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors disabled:opacity-40 disabled:hover:bg-transparent group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                  <span>Fetch (All &amp; Prune)</span>
                </div>
                <span className="text-[10px] text-subtext0 font-mono">{shortcut('Ctrl+Shift+F')}</span>
              </button>

              <div className="my-1 border-t border-surface0" />

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
                <span className="text-[10px] text-subtext0 font-mono">{shortcut('Ctrl+Shift+P')}</span>
              </button>

              <button
                type="button"
                disabled={!currentRepo || isSyncing}
                onClick={() => {
                  closeMenus();
                  setIsPullFromOpen(true);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors disabled:opacity-40 disabled:hover:bg-transparent group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <DownloadCloud className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                  <span>Pull from...</span>
                </div>
                <span className="text-[10px] text-subtext0 font-mono">{shortcut('Ctrl+Alt+P')}</span>
              </button>

              <div className="my-1 border-t border-surface0" />

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
                <span className="text-[10px] text-subtext0 font-mono">{shortcut('Ctrl+Shift+R')}</span>
              </button>

              <button
                type="button"
                disabled={!currentRepo || isSyncing}
                onClick={() => {
                  closeMenus();
                  setIsRebaseFromOpen(true);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors disabled:opacity-40 disabled:hover:bg-transparent group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <GitBranch className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                  <span>Rebase from...</span>
                </div>
                <span className="text-[10px] text-subtext0 font-mono">{shortcut('Ctrl+Alt+R')}</span>
              </button>

              <div className="my-1 border-t border-surface0" />

              <button
                type="button"
                disabled={!currentRepo || isSyncing || !isRebasing}
                onClick={() => {
                  runSync('rebase_continue');
                  closeMenus();
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors disabled:opacity-40 disabled:hover:bg-transparent group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Play className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                  <span>Rebase: Continue</span>
                </div>
              </button>

              <button
                type="button"
                disabled={!currentRepo || isSyncing || !isRebasing}
                onClick={() => {
                  runSync('rebase_skip');
                  closeMenus();
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors disabled:opacity-40 disabled:hover:bg-transparent group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <SkipForward className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                  <span>Rebase: Skip Commit</span>
                </div>
              </button>

              <button
                type="button"
                disabled={!currentRepo || isSyncing || !isRebasing}
                onClick={() => {
                  runSync('rebase_abort');
                  closeMenus();
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors disabled:opacity-40 disabled:hover:bg-transparent group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Undo2 className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                  <span>Rebase: Abort</span>
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
                  <GitCompare className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                  <span>Refresh Diff &amp; Conflicts</span>
                </div>
                <span className="text-[10px] text-subtext0 font-mono">{shortcut('Ctrl+R')}</span>
              </button>

              <div className="my-1 border-t border-surface0" />

              {/* Open in Submenu Trigger */}
              <div
                className="relative"
                onMouseEnter={() => setShowOpenInSubmenu(true)}
                onMouseLeave={() => setShowOpenInSubmenu(false)}
              >
                <button
                  type="button"
                  disabled={!currentRepo}
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors disabled:opacity-40 disabled:hover:bg-transparent group cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <ExternalLink className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                    <span>Open in</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                </button>

                {showOpenInSubmenu && currentRepo && (
                  <div className="absolute left-full top-0 ml-0.5 w-60 rounded-md shadow-2xl bg-mantle border border-surface0 py-1.5 z-50 text-xs">
                    <button
                      type="button"
                      onClick={async () => {
                        closeMenus();
                        try {
                          await openRepoInTerminal(currentRepo.local_path);
                          showToast('Opened repository in terminal');
                        } catch (err) {
                          showToast(`Failed to open terminal: ${err}`);
                        }
                      }}
                      className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Terminal className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                        <span>Terminal</span>
                      </div>
                      <span className="text-[10px] text-subtext0 font-mono">{shortcut('Alt+Shift+T')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        closeMenus();
                        try {
                          await openRepoInVsCode(currentRepo.local_path);
                          showToast('Opened repository in VS Code');
                        } catch (err) {
                          showToast(`Failed to open VS Code: ${err}`);
                        }
                      }}
                      className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Code2 className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                        <span>Visual Studio Code</span>
                      </div>
                      <span className="text-[10px] text-subtext0 font-mono">{shortcut('Alt+Shift+V')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        closeMenus();
                        try {
                          await openRepoInExplorer(currentRepo.local_path);
                          showToast(`Opened repository in ${fileManagerName}`);
                        } catch (err) {
                          showToast(`Failed to open ${fileManagerName}: ${err}`);
                        }
                      }}
                      className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Folder className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                        <span>{fileManagerName}</span>
                      </div>
                      <span className="text-[10px] text-subtext0 font-mono">{shortcut('Alt+Shift+E')}</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="my-1 border-t border-surface0" />

              <button
                type="button"
                disabled={!currentRepo}
                onClick={() => {
                  closeMenus();
                  openRepoSettings('remotes');
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors disabled:opacity-40 disabled:hover:bg-transparent group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <FolderCog className="w-3.5 h-3.5 text-accent group-hover:text-text transition-colors" />
                  <span className="font-medium text-accent">Repository Settings...</span>
                </div>
                <span className="text-[10px] text-subtext0 font-mono">{shortcut('Ctrl+Alt+S')}</span>
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

              <button
                type="button"
                onClick={() => {
                  closeMenus();
                  void invoke('open_webview_devtools');
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Code2 className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                  <span>Developer Tools</span>
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
      )}

      {/* Keyboard Shortcuts Modal */}
      {showShortcutsModal && (() => {
        const shortcutCategories = [
          {
            title: 'General & Workspace',
            icon: <FolderOpen className="w-3.5 h-3.5 text-brand" />,
            items: [
              { label: 'Open Repository', keys: shortcut('Ctrl+O') },
              { label: 'Preferences', keys: shortcut('Ctrl+,') },
              { label: 'Refresh Virtual Diff', keys: shortcut('Ctrl+R') },
            ],
          },
          {
            title: 'Git Synchronization',
            icon: <GitMerge className="w-3.5 h-3.5 text-brand" />,
            items: [
              { label: 'Fetch (All & Prune)', keys: shortcut('Ctrl+Shift+F') },
              { label: 'Pull', keys: shortcut('Ctrl+Shift+P') },
              { label: 'Pull from... (Advanced)', keys: shortcut('Ctrl+Alt+P') },
              { label: 'Rebase', keys: shortcut('Ctrl+Shift+R') },
              { label: 'Rebase from... (Advanced)', keys: shortcut('Ctrl+Alt+R') },
            ],
          },
          {
            title: 'External Tools',
            icon: <Terminal className="w-3.5 h-3.5 text-brand" />,
            items: [
              { label: 'Open Repo in Terminal', keys: shortcut('Alt+Shift+T') },
              { label: 'Open Repo in VS Code', keys: shortcut('Alt+Shift+V') },
              { label: `Open Repo in ${fileManagerName}`, keys: shortcut('Alt+Shift+E') },
              { label: `Open File in ${fileManagerName}`, keys: shortcut('Shift+Alt+R') },
            ],
          },
          {
            title: 'Diff & View Mode',
            icon: <Columns2 className="w-3.5 h-3.5 text-brand" />,
            items: [
              { label: 'Side-by-side Split Diff', keys: 'S' },
              { label: 'Inline Unified Diff', keys: 'U' },
              { label: 'Toggle Git Blame View', keys: shortcut('Alt+B') },
              { label: 'Display Performance Monitor', keys: shortcut('Ctrl+Shift+F12') },
            ],
          },
          {
            title: 'File Navigation',
            icon: <ArrowDown className="w-3.5 h-3.5 text-brand" />,
            items: [
              { label: 'Select Next File', keys: 'Down / J' },
              { label: 'Select Previous File', keys: 'Up / K' },
              { label: 'Select Next Conflict', keys: shortcut('Alt+C') },
            ],
          },
          {
            title: 'Copy Paths & URLs',
            icon: <Copy className="w-3.5 h-3.5 text-brand" />,
            items: [
              { label: 'Copy Relative Path', keys: shortcut('Ctrl+Shift+C') },
              { label: 'Copy Absolute Path', keys: shortcut('Shift+Alt+C') },
              { label: 'Copy Remote File URL', keys: shortcut('Ctrl+Shift+U') },
              { label: 'Copy Remote File URL from...', keys: shortcut('Ctrl+Alt+U') },
            ],
          },
        ];

        return (
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 select-none animate-in fade-in duration-100"
            onClick={() => setShowShortcutsModal(false)}
          >
            <div
              className="relative bg-mantle border border-surface0 p-5 sm:p-6 max-w-5xl w-full shadow-2xl animate-in zoom-in-95 duration-150 text-text cursor-default rounded-none"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div
                data-tauri-drag-region
                className="flex items-center justify-between pb-3.5 border-b border-surface0 cursor-default"
              >
                <div data-tauri-drag-region className="flex items-center gap-2 pointer-events-none">
                  <Keyboard className="w-4 h-4 text-brand" />
                  <h3 className="text-sm font-bold text-text tracking-tight">Keyboard Shortcuts</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowShortcutsModal(false)}
                  className="p-1 text-subtext0 hover:text-text hover:bg-surface0 transition-colors cursor-pointer rounded-none"
                  title="Close (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Categories Grid (Max 2 rows on desktop) */}
              <div className="py-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6">
                {shortcutCategories.map((category) => (
                  <div
                    key={category.title}
                    className="flex flex-col justify-start"
                  >
                    <div className="flex items-center gap-2 pb-1.5 mb-2.5 border-b border-surface0/60 text-xs font-semibold text-text">
                      {category.icon}
                      <span>{category.title}</span>
                    </div>
                    <div className="space-y-1.5">
                      {category.items.map((item) => (
                        <div
                          key={item.label}
                          className="flex items-center justify-between gap-3 text-xs py-0.5 px-1 -mx-1 hover:bg-surface0/30 transition-colors group"
                        >
                          <span className="text-subtext1 group-hover:text-text transition-colors truncate" title={item.label}>
                            {item.label}
                          </span>
                          <span className="font-mono text-xs font-semibold text-blue shrink-0 select-none tracking-tight">
                            {item.keys}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="pt-3 border-t border-surface0 flex items-center justify-between">
                <span className="text-[11px] text-subtext0 font-mono">Press Esc to close</span>
                <button
                  type="button"
                  onClick={() => setShowShortcutsModal(false)}
                  className="px-5 py-1.5 bg-surface1 hover:bg-surface2 text-text font-semibold text-xs cursor-pointer transition-colors border border-surface1 hover:border-surface2 rounded-none"
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* About Modal */}
      <AboutModal
        isOpen={showAboutModal}
        onClose={() => setShowAboutModal(false)}
      />
    </>
  );
};
