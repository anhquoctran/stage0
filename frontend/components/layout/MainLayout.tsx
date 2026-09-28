import React, { useEffect } from 'react';
import { TopBar } from './TopBar';
import { StatusBar } from './StatusBar';
import { FileList } from '../git/FileList';
import { DiffViewer } from '../git/DiffViewer';
import { ConflictBanner } from '../git/ConflictBanner';
import { useGitStore } from '../../store/useGitStore';
import { X, AlertCircle } from 'lucide-react';

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
    openRepoDialog,
  } = useGitStore();

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
      } else if (e.key === 's' && !e.ctrlKey && !e.metaKey) {
        setViewMode('split');
      } else if (e.key === 'u' && !e.ctrlKey && !e.metaKey) {
        setViewMode('unified');
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        refreshDiff();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectNextFile, selectPrevFile, setViewMode, refreshDiff]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-crust text-text font-sans">
      {/* Top Application Bar */}
      <TopBar />

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
            className="p-1 hover:bg-red/20 rounded text-red hover:text-text transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Central Review Workspace */}
      <main className="flex-1 flex overflow-hidden">
        {currentRepo ? (
          <>
            <FileList
              files={diffPayload?.files || []}
              selectedFile={selectedFile}
              onSelectFile={selectFile}
              isLoading={isDiffLoading}
            />
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
    </div>
  );
};
