import React from 'react';
import { LANE_STEP, referenceColor } from '../constants/gitGraphConstants';
import { useGitGraphState } from '../hooks/useGitGraphState';
import type { GitGraphModalProps } from '../types/GitGraphModalProps';
import { CommitHashContextMenu } from './CommitHashContextMenu';
import { GitGraphFooter } from './git-graph/GitGraphFooter';
import { GitGraphHeader } from './git-graph/GitGraphHeader';
import { GitGraphSearchToolbar } from './git-graph/GitGraphSearchToolbar';
import { GitGraphTable } from './git-graph/GitGraphTable';
import { GitGraphCommitDetails } from './GitGraphCommitDetails';

export const GitGraphModal: React.FC<GitGraphModalProps> = ({ isOpen, repoPath, onClose }) => {
  const {
    graph,
    error,
    isLoading,
    setRefreshToken,
    query,
    setQuery,
    caseSensitive,
    setCaseSensitive,
    isSearchingCommitMessages,
    messageSearchError,
    setActiveMatchIndex,
    selectedCommitHash,
    setSelectedCommitHash,
    commitContextMenu,
    setCommitContextMenu,
    selectedCommitMessage,
    isLoadingCommitMessage,
    commitMessageError,
    commitRows,
    commits,
    searchText,
    isSearchEligible,
    isSearchDebouncing,
    hasSearchFilter,
    handleCopyCommitHash,
    graphLayout,
    matchingCommitIndexes,
    displayedCommitIndexes,
    selectedCommit,
    currentMatchIndex,
    currentMatchCommit,
    navigateMatches,
    handleSearchKeyDown,
  } = useGitGraphState({ isOpen, repoPath, onClose });

  if (!isOpen) return null;

  const graphWidth = Math.max(150, 24 + graphLayout.laneCount * LANE_STEP);
  const isSearchingWithoutMetadataMatches =
    hasSearchFilter && displayedCommitIndexes.length === 0 && isSearchingCommitMessages;

  const counterText =
    searchText && !isSearchEligible
      ? '3+'
      : isSearchDebouncing
        ? '…/…'
        : hasSearchFilter
          ? isSearchingCommitMessages && matchingCommitIndexes.length === 0
            ? '…/…'
            : `${currentMatchIndex >= 0 ? currentMatchIndex + 1 : 0}/${matchingCommitIndexes.length}`
          : null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 top-8.5 z-50 flex items-center justify-center bg-crust/75 p-4 backdrop-blur-xs animate-in fade-in duration-150 rounded-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="git-graph-title"
        className="flex h-[82vh] max-h-[calc(100vh-5rem)] w-[96vw] max-w-[1600px] flex-col overflow-hidden border border-surface0 bg-mantle shadow-2xl animate-in zoom-in-95 duration-150 rounded-sm"
      >
        <GitGraphHeader
          branch={graph?.branch}
          isDetached={graph?.is_detached}
          isLoading={isLoading}
          onRefresh={() => setRefreshToken((token) => token + 1)}
          onClose={onClose}
        />

        <GitGraphSearchToolbar
          query={query}
          setQuery={setQuery}
          caseSensitive={caseSensitive}
          setCaseSensitive={setCaseSensitive}
          setActiveMatchIndex={setActiveMatchIndex}
          onKeyDown={handleSearchKeyDown}
          navigateMatches={navigateMatches}
          canNavigate={!isSearchDebouncing && matchingCommitIndexes.length > 0}
          counterText={counterText}
          messageSearchError={messageSearchError}
        />

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <GitGraphTable
            graph={graph}
            error={error}
            isLoading={isLoading}
            hasSearchFilter={hasSearchFilter}
            isSearchingWithoutMetadataMatches={isSearchingWithoutMetadataMatches}
            query={query}
            graphWidth={graphWidth}
            commits={commits}
            displayedCommitIndexes={displayedCommitIndexes}
            matchingCommitIndexes={matchingCommitIndexes}
            currentMatchCommit={currentMatchCommit}
            selectedCommitHash={selectedCommitHash}
            graphLayout={graphLayout}
            onSelectCommit={(hash) => setSelectedCommitHash(hash)}
            onContextMenu={(event, hash) => {
              setSelectedCommitHash(hash);
              setCommitContextMenu({
                x: event.clientX,
                y: event.clientY,
                hash,
              });
            }}
            onRowRef={(hash, element) => {
              if (element) commitRows.current.set(hash, element);
              else commitRows.current.delete(hash);
            }}
          />

          <GitGraphCommitDetails
            selectedCommit={selectedCommit}
            selectedCommitMessage={selectedCommitMessage}
            isLoadingCommitMessage={isLoadingCommitMessage}
            commitMessageError={commitMessageError}
            handleCopyCommitHash={handleCopyCommitHash}
            referenceColor={referenceColor}
          />
        </div>

        <GitGraphFooter
          hasSearchFilter={hasSearchFilter}
          displayedCount={displayedCommitIndexes.length}
          isTruncated={graph?.truncated}
          totalCount={commits.length}
        />

        {commitContextMenu && (
          <CommitHashContextMenu
            menu={commitContextMenu}
            onCopy={(hash) => void handleCopyCommitHash(hash)}
            onClose={() => setCommitContextMenu(null)}
          />
        )}
      </section>
    </div>
  );
};
