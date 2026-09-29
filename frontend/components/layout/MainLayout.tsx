import React, { useEffect, useState, useRef, useCallback } from 'react';
import { TopBar } from './TopBar';
import { StatusBar } from './StatusBar';
import { FileList } from '../git/FileList';
import { DiffViewer } from '../git/DiffViewer';
import { ConflictBanner } from '../git/ConflictBanner';
import { PreferencesModal } from '../preferences/PreferencesModal';
import { PullFromModal } from '../git/PullFromModal';
import { RebaseFromModal } from '../git/RebaseFromModal';
import { RemoteUrlFromModal } from '../git/RemoteUrlFromModal';
import { useGitStore } from '../../store/useGitStore';
import { usePreferencesStore } from '../../store/usePreferencesStore';
import { X, AlertCircle, Check } from 'lucide-react';
import {
  revealInOs,
  getAbsoluteFilePath,
  buildRemoteFileUrl,
} from '../../utils/fileActions';

const DEFAULT_SIDEBAR_WIDTH = 320;
const MIN_SIDEBAR_WIDTH = 220;
const MAX_SIDEBAR_WIDTH = 640;

export const MainLayout: React.FC = () => {
  const {
    currentRepo,
    diffPayload,
    conflictReport,
    selectedFile,
    viewMode,
    isDiffLoading,
    error,
    clearError,
    selectFile,
    selectNextFile,
    selectPrevFile,
    setViewMode,
    refreshDiff,
    runSync,
    setIsPullFromOpen,
    setIsRebaseFromOpen,
    openRepoDialog,
    remoteUrl,
    compareBranch,
    toastMessage,
    showToast,
    setIsRemoteUrlFromOpen,
    setTargetFileForUrl,
  } = useGitStore();

  const { setIsPreferencesOpen, showInlineBlame, toggleInlineBlame } =
    usePreferencesStore();

  // Resizable Sidebar State with LocalStorage Persistence
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('stage0_sidebar_width');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= MIN_SIDEBAR_WIDTH && parsed <= MAX_SIDEBAR_WIDTH) {
          return parsed;
        }
      }
    } catch {
      // ignore storage access errors
    }
    return DEFAULT_SIDEBAR_WIDTH;
  });

  const [isResizing, setIsResizing] = useState(false);
  const isResizingRef = useRef(false);

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    setIsResizing(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingRef.current) return;
      const newWidth = Math.min(
        Math.max(moveEvent.clientX, MIN_SIDEBAR_WIDTH),
        MAX_SIDEBAR_WIDTH
      );
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      isResizingRef.current = false;
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);

      setSidebarWidth((latestWidth) => {
        try {
          localStorage.setItem('stage0_sidebar_width', String(latestWidth));
        } catch {
          // ignore
        }
        return latestWidth;
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, []);

  const resetSidebarWidth = () => {
    setSidebarWidth(DEFAULT_SIDEBAR_WIDTH);
    try {
      localStorage.setItem('stage0_sidebar_width', String(DEFAULT_SIDEBAR_WIDTH));
    } catch {
      // ignore
    }
  };

  const handleSelectConflictFile = (filePath: string) => {
    if (!diffPayload) return;
    const file = diffPayload.files.find((f) => f.path === filePath);
    if (file) {
      selectFile(file);
    }
  };

  // Global Keyboard Shortcuts (Like GitKraken / Sublime Merge / Fork)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        selectNextFile();
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        selectPrevFile();
      } else if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        (e.key.toLowerCase() === 't' || e.code === 'KeyT')
      ) {
        e.preventDefault();
        setIsPreferencesOpen(true);
      } else if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        (e.key.toLowerCase() === 'f' || e.code === 'KeyF')
      ) {
        e.preventDefault();
        runSync('fetch');
      } else if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        (e.key.toLowerCase() === 'p' || e.code === 'KeyP')
      ) {
        e.preventDefault();
        runSync('pull');
      } else if (
        (e.ctrlKey || e.metaKey) &&
        e.altKey &&
        (e.key.toLowerCase() === 'p' || e.code === 'KeyP')
      ) {
        e.preventDefault();
        setIsPullFromOpen(true);
      } else if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        (e.key.toLowerCase() === 'r' || e.code === 'KeyR')
      ) {
        e.preventDefault();
        runSync('rebase');
      } else if (
        (e.ctrlKey || e.metaKey) &&
        e.altKey &&
        (e.key.toLowerCase() === 'r' || e.code === 'KeyR')
      ) {
        e.preventDefault();
        setIsRebaseFromOpen(true);
      } else if (e.key === 's' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setViewMode('split');
      } else if (e.key === 'u' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setViewMode('unified');
      } else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        refreshDiff();
      } else if (e.shiftKey && e.altKey && (e.key.toLowerCase() === 'r' || e.code === 'KeyR')) {
        // Shift+Alt+R: Open current file in OS File Explorer
        if (currentRepo && selectedFile) {
          e.preventDefault();
          revealInOs(currentRepo.local_path, selectedFile.path)
            .then(() => showToast('Revealed file in OS File Explorer'))
            .catch((err) => showToast(`Failed to open explorer: ${err}`));
        }
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key.toLowerCase() === 'c' || e.code === 'KeyC')) {
        // Ctrl+Shift+C: Copy relative path
        if (selectedFile) {
          e.preventDefault();
          navigator.clipboard.writeText(selectedFile.path);
          showToast(`Copied relative path: ${selectedFile.path}`);
        }
      } else if (e.shiftKey && e.altKey && (e.key.toLowerCase() === 'c' || e.code === 'KeyC')) {
        // Shift+Alt+C: Copy absolute path
        if (currentRepo && selectedFile) {
          e.preventDefault();
          const abs = getAbsoluteFilePath(currentRepo.local_path, selectedFile.path);
          navigator.clipboard.writeText(abs);
          showToast('Copied absolute path to clipboard');
        }
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key.toLowerCase() === 'u' || e.code === 'KeyU')) {
        // Ctrl+Shift+U: Copy remote file URL
        if (selectedFile) {
          e.preventDefault();
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
      } else if ((e.ctrlKey || e.metaKey) && e.altKey && (e.key.toLowerCase() === 'u' || e.code === 'KeyU')) {
        // Ctrl+Alt+U: Copy remote file URL from...
        if (selectedFile) {
          e.preventDefault();
          setTargetFileForUrl(selectedFile);
          setIsRemoteUrlFromOpen(true);
        }
      } else if (e.altKey && e.shiftKey && (e.key.toLowerCase() === 'b' || e.code === 'KeyB')) {
        // Alt+Shift+B: Toggle inline git blame
        e.preventDefault();
        toggleInlineBlame();
        showToast(showInlineBlame ? 'Disabled inline git blame' : 'Enabled inline git blame');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectNextFile,
    selectPrevFile,
    setViewMode,
    refreshDiff,
    setIsPreferencesOpen,
    runSync,
    setIsPullFromOpen,
    setIsRebaseFromOpen,
    selectedFile,
    toggleInlineBlame,
    showInlineBlame,
    showToast,
    setTargetFileForUrl,
    setIsRemoteUrlFromOpen,
  ]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-crust text-text font-sans">
      {/* Top Application Bar with Menu Bar & Action Toolbar */}
      <TopBar />

      {/* Preferences Modal Dialog */}
      <PreferencesModal />

      {/* Pull From Remote Modal Dialog */}
      <PullFromModal />

      {/* Rebase From Branch Modal Dialog */}
      <RebaseFromModal />

      {/* Remote URL From Branch/Commit Modal Dialog */}
      <RemoteUrlFromModal />

      {/* In-Memory Merge Conflict Banner */}
      <ConflictBanner
        conflictReport={conflictReport}
        onSelectConflictFile={handleSelectConflictFile}
      />

      {/* Global Error Banner */}
      {error && (
        <div className="bg-red/15 border-b border-red/30 px-4 py-2 flex items-center justify-between text-text text-xs shrink-0 z-10">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red shrink-0" />
            <span className="font-mono text-red font-medium">{error}</span>
          </div>
          <button
            type="button"
            onClick={clearError}
            className="p-1 hover:bg-red/20 rounded text-red hover:text-text transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Central Review Workspace */}
      <main className="flex-1 flex overflow-hidden relative">
        {currentRepo ? (
          <>
            <FileList
              files={diffPayload?.files || []}
              selectedFile={selectedFile}
              onSelectFile={selectFile}
              isLoading={isDiffLoading}
              width={sidebarWidth}
            />

            {/* Draggable Resizer Splitter between Sidebar and DiffViewer */}
            <div
              role="separator"
              aria-orientation="vertical"
              title="Drag to resize sidebar (double-click to reset)"
              onMouseDown={startResizing}
              onDoubleClick={resetSidebarWidth}
              className={`w-1.5 -ml-1 relative z-20 cursor-col-resize hover:bg-blue/40 transition-colors flex items-center justify-center select-none group ${
                isResizing ? 'bg-blue' : 'bg-transparent'
              }`}
            >
              <div
                className={`w-0.5 h-7 rounded-full transition-colors ${
                  isResizing ? 'bg-crust' : 'bg-surface2 group-hover:bg-blue'
                }`}
              />
            </div>

            <DiffViewer
              selectedFile={selectedFile}
              diffPayload={diffPayload}
              viewMode={viewMode}
              onToggleViewMode={setViewMode}
              isLoading={isDiffLoading}
              onOpenRepo={openRepoDialog}
            />
          </>
        ) : (
          <DiffViewer
            selectedFile={null}
            diffPayload={null}
            viewMode={viewMode}
            onToggleViewMode={setViewMode}
            onOpenRepo={openRepoDialog}
          />
        )}
      </main>

      {/* Bottom Status Bar */}
      <StatusBar />

      {/* Global Feedback Toast */}
      {toastMessage && (
        <div className="fixed bottom-10 right-6 z-50 bg-mantle border border-surface1 text-text text-xs px-3.5 py-2 shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <Check className="w-3.5 h-3.5 text-green shrink-0" />
          <span className="font-medium">{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
