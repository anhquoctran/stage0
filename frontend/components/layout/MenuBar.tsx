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
  Play,
  SkipForward,
  FileText,
  Globe,
  ExternalLink,
  History,
  GitCommit,
  Terminal,
  Code2,
  Folder,
  Trash2,
  FolderGit2,
  GitPullRequest,
} from 'lucide-react';
import {
  revealInOs,
  getAbsoluteFilePath,
  buildRemoteFileUrl,
  openRepoInTerminal,
  openRepoInVsCode,
  openRepoInExplorer,
  getOsFileManagerName,
} from '../../utils/fileActions';
import { invoke } from '@tauri-apps/api/core';
import { useGitStore } from '../../store/useGitStore';
import { useThemeStore } from '../../store/useThemeStore';
import { usePreferencesStore } from '../../store/usePreferencesStore';
import { useVirtualMrStore } from '../../store/useVirtualMrStore';
import { AppLogo } from '../common/AppLogo';

export const MenuBar: React.FC = () => {
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

  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [showRecentSubmenu, setShowRecentSubmenu] = useState(false);
  const [showOpenInSubmenu, setShowOpenInSubmenu] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);

  const fileManagerName = getOsFileManagerName();

  const isMac =
    typeof navigator !== 'undefined' &&
    /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

  const menuBarRef = useRef<HTMLDivElement>(null);

  // Close menus when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
        setShowRecentSubmenu(false);
        setShowOpenInSubmenu(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveMenu(null);
        setShowRecentSubmenu(false);
        setShowOpenInSubmenu(false);
      } else if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === ',' || (e.shiftKey && (e.key.toLowerCase() === 't' || e.code === 'KeyT')))
      ) {
        e.preventDefault();
        setActiveMenu(null);
        setShowRecentSubmenu(false);
        setShowOpenInSubmenu(false);
        setIsPreferencesOpen(true);
      } else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        openRepoDialog();
      } else if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        (e.key.toLowerCase() === 'o' || e.code === 'KeyO')
      ) {
        e.preventDefault();
        setIsCloneModalOpen(true);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [openRepoDialog, setIsPreferencesOpen, setIsCloneModalOpen]);

  const handleMenuClick = (menuName: string) => {
    if (activeMenu === menuName) {
      setActiveMenu(null);
      setShowRecentSubmenu(false);
      setShowOpenInSubmenu(false);
    } else {
      setActiveMenu(menuName);
      setShowRecentSubmenu(false);
      setShowOpenInSubmenu(false);
    }
  };

  const handleMenuHover = (menuName: string) => {
    if (activeMenu !== null && activeMenu !== menuName) {
      setActiveMenu(menuName);
      setShowRecentSubmenu(false);
      setShowOpenInSubmenu(false);
    }
  };

  const closeMenus = () => {
    setActiveMenu(null);
    setShowRecentSubmenu(false);
    setShowOpenInSubmenu(false);
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
              {/* Active Repository Info */}
              {currentRepo && (
                <div className="px-3 py-2 bg-surface0/40 border-b border-surface0 mb-1.5">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-subtext1 flex items-center gap-1.5 mb-1">
                    <FolderGit2 className="w-3 h-3 text-primary" />
                    <span>Active Repository</span>
                  </div>
                  <div className="font-semibold text-text truncate text-xs">
                    {currentRepo.name}
                  </div>
                  <div className="text-[10px] text-subtext0 truncate font-mono" title={currentRepo.local_path}>
                    {currentRepo.local_path}
                  </div>
                </div>
              )}

              {/* New Virtual MR */}
              <button
                type="button"
                disabled={!currentRepo}
                onClick={() => {
                  closeMenus();
                  openNewMrDraft();
                }}
                onMouseEnter={() => {
                  setShowRecentSubmenu(false);
                  setShowOpenInSubmenu(false);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors disabled:opacity-40 disabled:hover:bg-transparent group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <GitPullRequest className="w-3.5 h-3.5 text-brand group-hover:text-brand transition-colors" />
                  <span>New Virtual MR...</span>
                </div>
                <span className="text-[10px] text-subtext0 font-mono">Ctrl+T</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  closeMenus();
                  openRepoDialog();
                }}
                onMouseEnter={() => {
                  setShowRecentSubmenu(false);
                  setShowOpenInSubmenu(false);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                  <span>Open Repository...</span>
                </div>
                <span className="text-[10px] text-subtext0 font-mono">Ctrl+O</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  closeMenus();
                  setIsCloneModalOpen(true);
                }}
                onMouseEnter={() => {
                  setShowRecentSubmenu(false);
                  setShowOpenInSubmenu(false);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Download className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                  <span>Clone Repository...</span>
                </div>
                <span className="text-[10px] text-subtext0 font-mono">
                  {isMac ? '⌘⇧O' : 'Ctrl+Shift+O'}
                </span>
              </button>

              {/* Open in Submenu Trigger */}
              <div
                className="relative"
                onMouseEnter={() => {
                  setShowOpenInSubmenu(true);
                  setShowRecentSubmenu(false);
                }}
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
                      <span className="text-[10px] text-subtext0 font-mono">Alt+Shift+T</span>
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
                      <span className="text-[10px] text-subtext0 font-mono">Alt+Shift+V</span>
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
                      <span className="text-[10px] text-subtext0 font-mono">Alt+Shift+E</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Recent Repos Submenu Trigger */}
              <div
                className="relative"
                onMouseEnter={() => {
                  setShowRecentSubmenu(true);
                  setShowOpenInSubmenu(false);
                }}
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
                  setShowOpenInSubmenu(false);
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
                onClick={() => {
                  closeMenus();
                  setIsPreferencesOpen(true);
                }}
                onMouseEnter={() => {
                  setShowRecentSubmenu(false);
                  setShowOpenInSubmenu(false);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Sliders className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                  <span>Preferences...</span>
                </div>
                <span className="text-[10px] text-subtext0 font-mono">
                  {isMac ? '⌘,' : 'Ctrl+,'}
                </span>
              </button>

              <div className="my-1 border-t border-surface0" />

              <button
                type="button"
                onClick={handleExitApp}
                onMouseEnter={() => {
                  setShowRecentSubmenu(false);
                  setShowOpenInSubmenu(false);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Power className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
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
                <span className="text-[10px] text-subtext0 font-mono">Shift+Alt+R</span>
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
                <span className="text-[10px] text-subtext0 font-mono">Alt+B</span>
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
                <span className="text-[10px] text-subtext0 font-mono">Ctrl+Shift+C</span>
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
                <span className="text-[10px] text-subtext0 font-mono">Shift+Alt+C</span>
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
                <span className="text-[10px] text-subtext0 font-mono">Ctrl+Shift+U</span>
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
                <span className="text-[10px] text-subtext0 font-mono">Ctrl+Alt+U</span>
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
                  <span className="text-[10px] text-subtext0 font-mono">Alt+B</span>
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
                  <span className="text-[10px] text-subtext0 font-mono">Alt+Shift+B</span>
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
            <div className="absolute left-0 top-full mt-0.5 w-68 rounded-md shadow-2xl bg-mantle border border-surface0 py-1.5 z-50 text-xs">
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
                <span className="text-[10px] text-subtext0 font-mono">Ctrl+Shift+F</span>
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
                <span className="text-[10px] text-subtext0 font-mono">Ctrl+Shift+P</span>
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
                  <Sliders className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                  <span>Pull from...</span>
                </div>
                <span className="text-[10px] text-subtext0 font-mono">Ctrl+Alt+P</span>
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
                <span className="text-[10px] text-subtext0 font-mono">Ctrl+Shift+R</span>
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
                  <Sliders className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                  <span>Rebase from...</span>
                </div>
                <span className="text-[10px] text-subtext0 font-mono">Ctrl+Alt+R</span>
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
                  <XCircle className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
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
                  <RotateCw className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                  <span>Refresh Diff &amp; Conflicts</span>
                </div>
                <span className="text-[10px] text-subtext0 font-mono">Ctrl+R</span>
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
                      <span className="text-[10px] text-subtext0 font-mono">Alt+Shift+T</span>
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
                      <span className="text-[10px] text-subtext0 font-mono">Alt+Shift+V</span>
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
                      <span className="text-[10px] text-subtext0 font-mono">Alt+Shift+E</span>
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
                  <Sliders className="w-3.5 h-3.5 text-accent group-hover:text-text transition-colors" />
                  <span className="font-medium text-accent">Repository Settings...</span>
                </div>
                <span className="text-[10px] text-subtext0 font-mono">Ctrl+Alt+S</span>
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
        <div className="fixed inset-x-0 bottom-0 top-8.5 z-50 bg-crust/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-mantle border border-surface0 rounded-xl p-5 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-150">
            <div
              data-tauri-drag-region
              className="flex items-center justify-between pb-3 border-b border-surface0 cursor-default"
            >
              <div data-tauri-drag-region className="flex items-center gap-2 pointer-events-none">
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

            <div className="py-4 space-y-2 text-xs max-h-80 overflow-y-auto pr-1">
              <div className="flex items-center justify-between">
                <span className="text-subtext1">Open Repository</span>
                <kbd className="px-2 py-0.5 rounded bg-surface0 text-text font-mono text-[11px] border border-surface1">Ctrl+O</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-subtext1">Preferences</span>
                <kbd className="px-2 py-0.5 rounded bg-surface0 text-text font-mono text-[11px] border border-surface1">{isMac ? '⌘,' : 'Ctrl+,'}</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-subtext1">Refresh Virtual Diff</span>
                <kbd className="px-2 py-0.5 rounded bg-surface0 text-text font-mono text-[11px] border border-surface1">Ctrl+R</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-subtext1">Fetch (All &amp; Prune)</span>
                <kbd className="px-2 py-0.5 rounded bg-surface0 text-text font-mono text-[11px] border border-surface1">Ctrl+Shift+F</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-subtext1">Pull</span>
                <kbd className="px-2 py-0.5 rounded bg-surface0 text-text font-mono text-[11px] border border-surface1">Ctrl+Shift+P</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-subtext1">Pull from... (Advanced)</span>
                <kbd className="px-2 py-0.5 rounded bg-surface0 text-text font-mono text-[11px] border border-surface1">Ctrl+Alt+P</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-subtext1">Rebase</span>
                <kbd className="px-2 py-0.5 rounded bg-surface0 text-text font-mono text-[11px] border border-surface1">Ctrl+Shift+R</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-subtext1">Rebase from... (Advanced)</span>
                <kbd className="px-2 py-0.5 rounded bg-surface0 text-text font-mono text-[11px] border border-surface1">Ctrl+Alt+R</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-subtext1">Open Repo in Terminal</span>
                <kbd className="px-2 py-0.5 rounded bg-surface0 text-text font-mono text-[11px] border border-surface1">Alt+Shift+T</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-subtext1">Open Repo in VS Code</span>
                <kbd className="px-2 py-0.5 rounded bg-surface0 text-text font-mono text-[11px] border border-surface1">Alt+Shift+V</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-subtext1">Open Repo in {fileManagerName}</span>
                <kbd className="px-2 py-0.5 rounded bg-surface0 text-text font-mono text-[11px] border border-surface1">Alt+Shift+E</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-subtext1">Open File in {fileManagerName}</span>
                <kbd className="px-2 py-0.5 rounded bg-surface0 text-text font-mono text-[11px] border border-surface1">Shift+Alt+R</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-subtext1">Copy Relative Path</span>
                <kbd className="px-2 py-0.5 rounded bg-surface0 text-text font-mono text-[11px] border border-surface1">Ctrl+Shift+C</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-subtext1">Copy Absolute Path</span>
                <kbd className="px-2 py-0.5 rounded bg-surface0 text-text font-mono text-[11px] border border-surface1">Shift+Alt+C</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-subtext1">Copy Remote File URL</span>
                <kbd className="px-2 py-0.5 rounded bg-surface0 text-text font-mono text-[11px] border border-surface1">Ctrl+Shift+U</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-subtext1">Toggle Git Blame View</span>
                <kbd className="px-2 py-0.5 rounded bg-surface0 text-text font-mono text-[11px] border border-surface1">Alt+B</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-subtext1">Copy Remote File URL from...</span>
                <kbd className="px-2 py-0.5 rounded bg-surface0 text-text font-mono text-[11px] border border-surface1">Ctrl+Alt+U</kbd>
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
        <div className="fixed inset-x-0 bottom-0 top-8.5 z-50 bg-crust/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            data-tauri-drag-region
            className="bg-mantle border border-surface0 rounded-xl p-5 max-w-sm w-full shadow-2xl text-center animate-in zoom-in-95 duration-150 cursor-default"
          >
            <AppLogo size="md" className="mx-auto mb-3 pointer-events-none" />
            <h3 data-tauri-drag-region className="text-base font-bold text-text pointer-events-none">Stage0</h3>
            <p data-tauri-drag-region className="text-xs font-mono text-subtext1 mb-2 pointer-events-none">v0.1.0 • Local-First Virtual MR Sandbox</p>
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
