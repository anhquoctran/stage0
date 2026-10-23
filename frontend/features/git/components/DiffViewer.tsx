import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ReviewableDiff } from './ReviewableDiff';
import { extractFileHunks, inferLanguage } from '../utils/diffParser';
import { useGitStore } from '../store/useGitStore';
import { useThemeStore } from '../../../core/store/useThemeStore';
import { usePreferencesStore } from '../../preferences/store/usePreferencesStore';
import { BlameViewer } from './BlameViewer';
import { InlineBlame } from './InlineBlame';
import { ConflictViewer } from './ConflictViewer';
import { DiffDiscussionsBanner } from './DiffDiscussionsBanner';
import { WelcomeScreen } from '../../../core/components/layout/WelcomeScreen';
import { DiffLoadingState } from './diff-viewer/DiffLoadingState';
import { DiffErrorState } from './diff-viewer/DiffErrorState';
import { DiffUncomputedState } from './diff-viewer/DiffUncomputedState';
import { DiffEmptyOverview } from './diff-viewer/DiffEmptyOverview';
import { DiffToolbar } from './diff-viewer/DiffToolbar';
import { DiffConflictNotificationBar } from './diff-viewer/DiffConflictNotificationBar';
import { DiffConflictRegionsBanner } from './diff-viewer/DiffConflictRegionsBanner';
import { DiffBinaryPlaceholder } from './diff-viewer/DiffBinaryPlaceholder';
import { DiffNoChangesPlaceholder } from './diff-viewer/DiffNoChangesPlaceholder';
import { useInlineBlamePortal } from './diff-viewer/useInlineBlamePortal';
import type { DiffViewerProps } from '../types/DiffViewerProps';

export const DiffViewer: React.FC<DiffViewerProps> = ({
  selectedFile,
  diffPayload,
  viewMode,
  onToggleViewMode,
  isLoading = false,
  onOpenRepo,
}) => {
  const {
    selectNextFile,
    selectPrevFile,
    selectNextConflictFile,
    selectPrevConflictFile,
    baseBranch,
    compareBranch,
    fileViewTab,
    setFileViewTab,
    blamePayload,
    fetchFileBlame,
    remoteUrl,
    showToast,
    currentRepo,
    conflictReport,
    diffError,
    activeConflictPreview,
    refreshDiff,
  } = useGitStore();

  const { theme } = useThemeStore();
  const {
    fontFamily,
    fontSize,
    lineSpacing,
    enableLigatures,
    isBold,
    isItalic,
    isUnderline,
    showInlineBlame,
    toggleInlineBlame,
  } = usePreferencesStore();

  const [copied, setCopied] = useState(false);

  const hunks = useMemo(() => {
    if (!diffPayload || !selectedFile) return [];
    return extractFileHunks(
      diffPayload.raw_diff,
      selectedFile.path,
      selectedFile.old_path
    );
  }, [diffPayload, selectedFile]);

  const fileLang = useMemo(() => {
    if (!selectedFile) return 'text';
    return inferLanguage(selectedFile.path);
  }, [selectedFile]);

  const diffData = useMemo(() => {
    if (!selectedFile) return null;
    return {
      oldFile: {
        fileName: selectedFile.old_path || selectedFile.path,
        fileLang,
      },
      newFile: {
        fileName: selectedFile.path,
        fileLang,
      },
      hunks,
    };
  }, [selectedFile, fileLang, hunks]);

  const {
    diffContainerRef,
    handleDiffClick,
    activeLine,
    activeBlameCommit,
    portalMount,
  } = useInlineBlamePortal({
    selectedFile,
    currentRepo,
    compareBranch,
    baseBranch,
    fetchFileBlame,
    blamePayload,
    showInlineBlame,
    viewMode,
    fileViewTab,
    fontSize,
    fontFamily,
    theme,
    diffData,
  });

  const handleCopyPath = () => {
    if (!selectedFile) return;
    navigator.clipboard.writeText(selectedFile.path);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentFileIndex = useMemo(() => {
    if (!diffPayload || !selectedFile) return -1;
    return diffPayload.files.findIndex((f) => f.path === selectedFile.path);
  }, [diffPayload, selectedFile]);

  const conflictedFiles = useMemo(
    () => diffPayload?.files.filter((f) => f.is_conflicted && !f.is_binary) || [],
    [diffPayload]
  );

  const currentConflictIndex = useMemo(
    () => conflictedFiles.findIndex((f) => f.path === selectedFile?.path),
    [conflictedFiles, selectedFile]
  );

  const scrollToFirstConflict = () => {
    if (!diffContainerRef.current) return;
    const items = diffContainerRef.current.querySelectorAll(
      '.diff-line-content, .diff-line-content-item, .diff-line-old, .diff-line-new'
    );
    for (const el of items) {
      if (
        el.textContent?.includes('<<<<<<<') ||
        el.textContent?.includes('=======') ||
        el.textContent?.includes('>>>>>>>')
      ) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('bg-red/30');
        setTimeout(() => el.classList.remove('bg-red/30'), 2500);
        showToast('Jumped to conflict marker');
        return;
      }
    }
    const firstHunk = diffContainerRef.current.querySelector('.diff-line-old, .diff-line-new');
    if (firstHunk) {
      firstHunk.scrollIntoView({ behavior: 'smooth', block: 'center' });
      showToast('Jumped to first diff modification');
    }
  };

  const hasPrev = currentFileIndex > 0;
  const hasNext = Boolean(diffPayload && currentFileIndex !== -1 && currentFileIndex < diffPayload.files.length - 1);

  if (isLoading) {
    return <DiffLoadingState />;
  }

  if (!currentRepo) {
    return <WelcomeScreen onOpenRepo={onOpenRepo} />;
  }

  if (diffError) {
    return <DiffErrorState diffError={diffError} onRetry={() => void refreshDiff()} />;
  }

  if (!diffPayload) {
    return <DiffUncomputedState repo={currentRepo} />;
  }

  if (!selectedFile) {
    return (
      <DiffEmptyOverview
        diffPayload={diffPayload}
        baseBranch={baseBranch}
        compareBranch={compareBranch}
      />
    );
  }

  return (
    <section className="flex-1 flex flex-col h-full bg-base overflow-hidden select-none">
      <DiffToolbar
        selectedFile={selectedFile}
        diffPayload={diffPayload}
        viewMode={viewMode}
        onToggleViewMode={onToggleViewMode}
        fileViewTab={fileViewTab}
        setFileViewTab={setFileViewTab}
        showInlineBlame={showInlineBlame}
        toggleInlineBlame={toggleInlineBlame}
        copied={copied}
        onCopyPath={handleCopyPath}
        currentFileIndex={currentFileIndex}
        hasPrev={hasPrev}
        hasNext={hasNext}
        selectPrevFile={selectPrevFile}
        selectNextFile={selectNextFile}
        conflictedFiles={conflictedFiles}
        currentConflictIndex={currentConflictIndex}
        selectPrevConflictFile={selectPrevConflictFile}
        selectNextConflictFile={selectNextConflictFile}
      />

      {selectedFile.is_conflicted && (
        <DiffConflictNotificationBar
          selectedFile={selectedFile}
          conflictReport={conflictReport}
          activeConflictPreview={activeConflictPreview}
          currentRepo={currentRepo}
          onSwitchToConflicts={() => setFileViewTab('conflicts')}
          onScrollToFirstConflict={scrollToFirstConflict}
          onRefreshDiff={refreshDiff}
          onShowToast={showToast}
        />
      )}

      {/* Main Area: Conflict View, Blame View, or Visual Diff */}
      {fileViewTab === 'conflicts' && selectedFile?.is_conflicted && !selectedFile.is_binary ? (
        <ConflictViewer onSwitchToDiff={() => setFileViewTab('diff')} />
      ) : fileViewTab === 'blame' && !selectedFile.is_binary ? (
        <BlameViewer />
      ) : (
        <div
          ref={diffContainerRef}
          onClick={handleDiffClick}
          className="flex-1 overflow-auto bg-base p-2 relative rounded-sm"
        >
          {/* Conflict Alert & Quick Summary Card inside Diff View */}
          {!selectedFile.is_binary && selectedFile.is_conflicted && activeConflictPreview && activeConflictPreview.conflict_regions.length > 0 && (
            <DiffConflictRegionsBanner
              activeConflictPreview={activeConflictPreview}
              baseBranch={baseBranch}
              compareBranch={compareBranch}
              onOpen3Way={() => setFileViewTab('conflicts')}
            />
          )}

          <DiffDiscussionsBanner selectedFile={selectedFile} />

          {selectedFile.is_binary ? (
            <DiffBinaryPlaceholder />
          ) : diffData && hunks.length > 0 && diffPayload ? (
            <div className="border border-surface0 overflow-hidden bg-base shadow-sm rounded-sm">
              <ReviewableDiff
                key={`${selectedFile.path}-${viewMode}-${theme}-${fontFamily}-${fontSize}-${lineSpacing}-${enableLigatures}-${isBold}-${isItalic}-${isUnderline}`}
                data={diffData}
                filePath={selectedFile.path}
                oldCommit={diffPayload.merge_base_commit ?? diffPayload.base_commit}
                newCommit={diffPayload.compare_commit}
                viewMode={viewMode}
                theme={theme === 'mocha' ? 'dark' : 'light'}
                fontSize={fontSize}
              />
            </div>
          ) : (
            <DiffNoChangesPlaceholder status={selectedFile.status} />
          )}

          {showInlineBlame &&
            !selectedFile.is_binary &&
            portalMount &&
            activeBlameCommit &&
            activeLine &&
            createPortal(
              <InlineBlame
                commit={activeBlameCommit}
                lineNo={activeLine.lineNo}
                currentUser={{
                  name: blamePayload?.current_user_name,
                  email: blamePayload?.current_user_email,
                }}
                remoteUrl={remoteUrl}
                onOpenFullBlame={() => setFileViewTab('blame')}
                showToast={showToast}
              />,
              portalMount
            )}
        </div>
      )}
    </section>
  );
};
