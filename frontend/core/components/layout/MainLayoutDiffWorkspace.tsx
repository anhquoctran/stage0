import React from 'react';
import { FileList } from '../../../features/git/components/FileList';
import { MainLayoutDiffViewer } from './MainLayoutDiffViewer';
import type { MainLayoutDiffWorkspaceProps } from './MainLayoutDiffWorkspaceProps';

export const MainLayoutDiffWorkspace: React.FC<MainLayoutDiffWorkspaceProps> = ({
  diffPayload,
  selectedFile,
  selectFile,
  isDiffLoading,
  sidebarWidth,
  isResizing,
  startResizing,
  resetSidebarWidth,
  viewMode,
  setViewMode,
  openRepoDialog,
}) => {
  return (
    <div className="flex-1 flex overflow-hidden relative h-full w-full">
      <FileList
        files={diffPayload?.files || []}
        selectedFile={selectedFile}
        onSelectFile={(file) => selectFile(file)}
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
          className={`w-0.5 h-7 rounded-sm transition-colors ${
            isResizing ? 'bg-crust' : 'bg-surface2 group-hover:bg-blue'
          }`}
        />
      </div>

      <React.Suspense
        fallback={
          <div className="flex-1 grid place-items-center text-subtext0 text-xs">
            Loading diff viewer…
          </div>
        }
      >
        <MainLayoutDiffViewer
          selectedFile={selectedFile}
          diffPayload={diffPayload}
          viewMode={viewMode}
          onToggleViewMode={setViewMode}
          isLoading={isDiffLoading}
          onOpenRepo={openRepoDialog}
        />
      </React.Suspense>
    </div>
  );
};

