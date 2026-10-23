import React from 'react';
import { FileList } from '../../../git/components/FileList';
import { NewVirtualMrViewDiffViewer } from '../NewVirtualMrViewDiffViewer';
import { NewVirtualMrCommitsList } from './NewVirtualMrCommitsList';
import type { NewVirtualMrPreviewProps } from './NewVirtualMrPreviewProps';
import { NewVirtualMrPreviewToolbar } from './NewVirtualMrPreviewToolbar';

export function NewVirtualMrPreview({
  setPreviewTab,
  previewTab,
  draftMr,
  diffPayload,
  changeDraftBranches,
  selectedFile,
  selectFile,
  isDiffLoading,
  viewMode,
  setViewMode,
  openRepoDialog,
}: NewVirtualMrPreviewProps) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Preview Subtab Navigation */}
      <NewVirtualMrPreviewToolbar
        setPreviewTab={setPreviewTab}
        previewTab={previewTab}
        draftMr={draftMr}
        diffPayload={diffPayload}
      />

      {/* Preview Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {previewTab === 'commits' ? (
          /* COMMITS LIST PREVIEW */
          <NewVirtualMrCommitsList draftMr={draftMr} changeDraftBranches={changeDraftBranches} />
        ) : (
          /* FILES CHANGED / DIFF PREVIEW */
          <div className="flex-1 flex overflow-hidden relative">
            <FileList
              files={diffPayload?.files || []}
              selectedFile={selectedFile}
              onSelectFile={selectFile}
              isLoading={isDiffLoading}
              width={280}
            />
            <React.Suspense
              fallback={
                <div className="flex-1 grid place-items-center text-subtext0 text-xs">
                  Loading diff viewer…
                </div>
              }
            >
              <NewVirtualMrViewDiffViewer
                selectedFile={selectedFile}
                diffPayload={diffPayload}
                viewMode={viewMode}
                onToggleViewMode={setViewMode}
                isLoading={isDiffLoading}
                onOpenRepo={openRepoDialog}
              />
            </React.Suspense>
          </div>
        )}
      </div>
    </div>
  );
}
