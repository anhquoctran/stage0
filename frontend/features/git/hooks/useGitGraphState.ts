import { invoke } from '@tauri-apps/api/core';
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { copyTextToClipboard } from '../constants/gitGraphConstants';
import { useGitStore } from '../store/useGitStore';
import type { CommitContextMenuState } from '../types/CommitContextMenuState';
import type { GitGraph } from '../types/GitGraph';
import type { GitGraphModalProps } from '../types/GitGraphModalProps';
import { buildGitGraphLayout } from '../utils/buildGitGraphLayout';
import { useGitCommitMessage } from './useGitCommitMessage';
import { useGitGraphSearch } from './useGitGraphSearch';

export function useGitGraphState({ isOpen, repoPath, onClose }: GitGraphModalProps) {
  const showToast = useGitStore((state) => state.showToast);
  const [graph, setGraph] = useState<GitGraph | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const [selectedCommitHash, setSelectedCommitHash] = useState<string | null>(null);
  const [commitContextMenu, setCommitContextMenu] = useState<CommitContextMenuState | null>(null);

  const commitRows = useRef(new Map<string, HTMLTableRowElement>());

  useEffect(() => {
    if (!isOpen || !repoPath) return;

    let isCurrentRequest = true;
    setGraph(null);
    setError(null);
    setIsLoading(true);

    invoke<GitGraph>('get_current_branch_graph', { repoPath })
      .then((result) => {
        if (isCurrentRequest) setGraph(result);
      })
      .catch((reason: unknown) => {
        if (isCurrentRequest) {
          setError(reason instanceof Error ? reason.message : String(reason));
        }
      })
      .finally(() => {
        if (isCurrentRequest) setIsLoading(false);
      });

    return () => {
      isCurrentRequest = false;
    };
  }, [isOpen, repoPath, refreshToken]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const commits = graph?.commits ?? [];
  const {
    displayedCommitIndexes,
    matchingCommitIndexes,
    hasSearchFilter,
    isSearchDebouncing,
    query,
    setQuery,
    caseSensitive,
    setCaseSensitive,
    isSearchingCommitMessages,
    messageSearchError,
    searchText,
    isSearchEligible,
  } = useGitGraphSearch({ isOpen, repoPath, graph, commits });

  const handleCopyCommitHash = async (hash: string) => {
    setCommitContextMenu(null);
    try {
      await copyTextToClipboard(hash);
      showToast('Copied commit hash');
    } catch {
      showToast('Could not copy commit hash');
    }
  };

  const graphLayout = useMemo(() => buildGitGraphLayout(commits), [commits]);

  const displayedCommitKey = displayedCommitIndexes
    .map((index) => commits[index]?.hash ?? '')
    .join('\0');
  const previousDisplayedCommitKey = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (previousDisplayedCommitKey.current === displayedCommitKey) return;
    previousDisplayedCommitKey.current = displayedCommitKey;
    setSelectedCommitHash(null);
    setCommitContextMenu(null);
  }, [displayedCommitKey]);

  const displayedCommits = displayedCommitIndexes.map((index) => commits[index]);
  const selectedCommit =
    displayedCommits.find((commit) => commit.hash === selectedCommitHash) ?? null;

  const { selectedCommitMessage, isLoadingCommitMessage, commitMessageError } = useGitCommitMessage(
    { isOpen, repoPath, selectedCommit }
  );

  const currentMatchIndex = matchingCommitIndexes.length
    ? Math.min(activeMatchIndex, matchingCommitIndexes.length - 1)
    : -1;
  const currentMatchCommit =
    currentMatchIndex >= 0 ? commits[matchingCommitIndexes[currentMatchIndex]] : null;

  useEffect(() => {
    if (!hasSearchFilter) return;
    if (!currentMatchCommit) {
      return;
    }
    commitRows.current
      .get(currentMatchCommit.hash)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [currentMatchCommit?.hash, hasSearchFilter]);

  const navigateMatches = (direction: -1 | 1) => {
    if (isSearchDebouncing || matchingCommitIndexes.length === 0) return;
    const nextIndex =
      (activeMatchIndex + direction + matchingCommitIndexes.length) % matchingCommitIndexes.length;
    setActiveMatchIndex(nextIndex);
    const nextCommit = commits[matchingCommitIndexes[nextIndex]];
    if (nextCommit) setSelectedCommitHash(nextCommit.hash);
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      navigateMatches(event.shiftKey ? -1 : 1);
    }
  };

  return {
    isOpen,
    onClose,
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
  };
}
