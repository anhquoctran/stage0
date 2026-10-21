import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { GitGraphCommitDetails } from './GitGraphCommitDetails';
import { CommitHashContextMenu } from './CommitHashContextMenu';
import { GitGraphHeader } from './git-graph/GitGraphHeader';
import { GitGraphSearchToolbar } from './git-graph/GitGraphSearchToolbar';
import { GitGraphTable } from './git-graph/GitGraphTable';
import { GitGraphFooter } from './git-graph/GitGraphFooter';
import {
    LANE_STEP,
    referenceColor,
    copyTextToClipboard,
} from '../constants/gitGraphConstants';
import { useGitStore } from '../store/useGitStore';
import type { GitGraphModalProps } from '../types/GitGraphModalProps';
import type { GitGraph } from '../types/GitGraph';
import type { CommitMessageSearchResult } from '../types/CommitMessageSearchResult';
import type { CommitContextMenuState } from '../types/CommitContextMenuState';
import type { GraphRowLayout } from '../types/GraphRowLayout';

export const GitGraphModal: React.FC<GitGraphModalProps> = ({
    isOpen,
    repoPath,
    onClose,
}) => {
    const showToast = useGitStore((state) => state.showToast);
    const [graph, setGraph] = useState<GitGraph | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [refreshToken, setRefreshToken] = useState(0);
    const [query, setQuery] = useState('');
    const [debouncedSearchText, setDebouncedSearchText] = useState('');
    const [caseSensitive, setCaseSensitive] = useState(false);
    const [messageSearchResult, setMessageSearchResult] =
        useState<CommitMessageSearchResult | null>(null);
    const [isSearchingCommitMessages, setIsSearchingCommitMessages] =
        useState(false);
    const [messageSearchError, setMessageSearchError] = useState<string | null>(
        null,
    );
    const [activeMatchIndex, setActiveMatchIndex] = useState(0);
    const [selectedCommitHash, setSelectedCommitHash] = useState<string | null>(
        null,
    );
    const [commitContextMenu, setCommitContextMenu] =
        useState<CommitContextMenuState | null>(null);
    const [selectedCommitMessage, setSelectedCommitMessage] = useState<
        string | null
    >(null);
    const [isLoadingCommitMessage, setIsLoadingCommitMessage] = useState(false);
    const [commitMessageError, setCommitMessageError] = useState<string | null>(
        null,
    );
    const commitRows = useRef(new Map<string, HTMLTableRowElement>());
    const commitMessageRequest = useRef(0);

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
                    setError(
                        reason instanceof Error
                            ? reason.message
                            : String(reason),
                    );
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
    const searchText = query.trim();
    const isSearchEligible = Array.from(searchText).length >= 3;

    useEffect(() => {
        if (!isSearchEligible) {
            setDebouncedSearchText('');
            return;
        }

        const timeout = window.setTimeout(
            () => setDebouncedSearchText(searchText),
            300,
        );
        return () => window.clearTimeout(timeout);
    }, [isSearchEligible, searchText]);

    const activeSearchText = isSearchEligible ? debouncedSearchText : '';
    const isSearchDebouncing =
        isSearchEligible && searchText !== debouncedSearchText;
    const hasSearchFilter = Array.from(activeSearchText).length >= 3;

    useEffect(() => {
        if (!isOpen || !repoPath || !graph || !hasSearchFilter) {
            setMessageSearchResult(null);
            setIsSearchingCommitMessages(false);
            setMessageSearchError(null);
            return;
        }

        let isCurrentRequest = true;
        setMessageSearchResult(null);
        setMessageSearchError(null);
        setIsSearchingCommitMessages(true);
        invoke<string[]>('search_git_commit_messages', {
            repoPath,
            query: activeSearchText,
            caseSensitive,
            commitHashes: graph.commits.map((commit) => commit.hash),
        })
            .then((hashes) => {
                if (isCurrentRequest) {
                    setMessageSearchResult({
                        query: activeSearchText,
                        caseSensitive,
                        hashes: new Set(hashes),
                    });
                }
            })
            .catch((reason: unknown) => {
                if (isCurrentRequest) {
                    setMessageSearchError(
                        reason instanceof Error
                            ? reason.message
                            : String(reason),
                    );
                    setMessageSearchResult({
                        query: activeSearchText,
                        caseSensitive,
                        hashes: new Set(),
                    });
                }
            })
            .finally(() => {
                if (isCurrentRequest) setIsSearchingCommitMessages(false);
            });

        return () => {
            isCurrentRequest = false;
        };
    }, [
        activeSearchText,
        caseSensitive,
        graph,
        hasSearchFilter,
        isOpen,
        repoPath,
    ]);

    const handleCopyCommitHash = async (hash: string) => {
        setCommitContextMenu(null);
        try {
            await copyTextToClipboard(hash);
            showToast('Copied commit hash');
        } catch {
            showToast('Could not copy commit hash');
        }
    };

    const graphLayout = useMemo(() => {
        const rows: GraphRowLayout[] = [];
        let activeLanes: Array<string | null> = [];
        let laneCount = 1;

        for (const commit of commits) {
            let lane = activeLanes.indexOf(commit.hash);
            const hasIncomingEdge = lane >= 0;
            if (!hasIncomingEdge) {
                lane = activeLanes.indexOf(null);
                if (lane < 0) lane = activeLanes.length;
                activeLanes[lane] = commit.hash;
            }

            const lanesBeforeCommit = activeLanes.slice();
            const lanesAfterCommit = activeLanes.slice();
            lanesAfterCommit[lane] = null;

            const parentLanes = commit.parents.map((parent, parentIndex) => {
                const existingLane = lanesAfterCommit.indexOf(parent);
                if (existingLane >= 0) return existingLane;

                if (parentIndex === 0) {
                    lanesAfterCommit[lane] = parent;
                    return lane;
                }

                let newLane = lanesAfterCommit.findIndex(
                    (value, index) => index > lane && value === null,
                );
                if (newLane < 0) newLane = lanesAfterCommit.indexOf(null);
                if (newLane < 0) newLane = lanesAfterCommit.length;
                lanesAfterCommit[newLane] = parent;
                return newLane;
            });

            rows.push({
                lane,
                hasIncomingEdge,
                throughLanes: lanesBeforeCommit.flatMap((hash, index) =>
                    hash !== null && index !== lane ? [index] : [],
                ),
                parentLanes,
            });
            laneCount = Math.max(
                laneCount,
                lanesBeforeCommit.length,
                lanesAfterCommit.length,
                lane + 1,
            );
            activeLanes = lanesAfterCommit;
        }

        return { rows, laneCount };
    }, [commits]);

    const matchingCommitIndexes = useMemo(() => {
        const trimmedQuery = activeSearchText;
        const needle = caseSensitive
            ? trimmedQuery
            : trimmedQuery.toLowerCase();
        if (!hasSearchFilter) return [];
        const messageMatches =
            messageSearchResult?.query === trimmedQuery &&
            messageSearchResult.caseSensitive === caseSensitive
                ? messageSearchResult.hashes
                : null;

        return commits.flatMap((commit, index) => {
            const haystack = [
                commit.subject,
                commit.author_name,
                commit.author_email,
                commit.hash,
                commit.short_hash,
                ...commit.refs,
            ].join(' ');
            const searchable = caseSensitive
                ? haystack
                : haystack.toLowerCase();
            return searchable.includes(needle) ||
                messageMatches?.has(commit.hash)
                ? [index]
                : [];
        });
    }, [
        activeSearchText,
        caseSensitive,
        commits,
        hasSearchFilter,
        messageSearchResult,
    ]);

    const displayedCommitIndexes = useMemo(
        () =>
            hasSearchFilter
                ? matchingCommitIndexes
                : commits.map((_, index) => index),
        [commits, hasSearchFilter, matchingCommitIndexes],
    );
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

    const displayedCommits = displayedCommitIndexes.map(
        (index) => commits[index],
    );
    const selectedCommit =
        displayedCommits.find((commit) => commit.hash === selectedCommitHash) ??
        null;

    useEffect(() => {
        const requestId = ++commitMessageRequest.current;
        if (!isOpen || !repoPath || !selectedCommit) {
            setSelectedCommitMessage(null);
            setCommitMessageError(null);
            setIsLoadingCommitMessage(false);
            return;
        }

        setSelectedCommitMessage(null);
        setCommitMessageError(null);
        setIsLoadingCommitMessage(true);
        invoke<string>('get_git_commit_message', {
            repoPath,
            commitHash: selectedCommit.hash,
        })
            .then((message) => {
                if (commitMessageRequest.current === requestId)
                    setSelectedCommitMessage(message);
            })
            .catch((reason: unknown) => {
                if (commitMessageRequest.current === requestId) {
                    setCommitMessageError(
                        reason instanceof Error
                            ? reason.message
                            : String(reason),
                    );
                }
            })
            .finally(() => {
                if (commitMessageRequest.current === requestId)
                    setIsLoadingCommitMessage(false);
            });

        return () => {
            if (commitMessageRequest.current === requestId)
                commitMessageRequest.current += 1;
        };
    }, [isOpen, repoPath, selectedCommit]);

    const currentMatchIndex = matchingCommitIndexes.length
        ? Math.min(activeMatchIndex, matchingCommitIndexes.length - 1)
        : -1;
    const currentMatchCommit =
        currentMatchIndex >= 0
            ? commits[matchingCommitIndexes[currentMatchIndex]]
            : null;

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
            (activeMatchIndex + direction + matchingCommitIndexes.length) %
            matchingCommitIndexes.length;
        setActiveMatchIndex(nextIndex);
        const nextCommit = commits[matchingCommitIndexes[nextIndex]];
        if (nextCommit) setSelectedCommitHash(nextCommit.hash);
    };

    const handleSearchKeyDown = (
        event: React.KeyboardEvent<HTMLInputElement>,
    ) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            navigateMatches(event.shiftKey ? -1 : 1);
        }
    };

    if (!isOpen) return null;

    const graphWidth = Math.max(150, 24 + graphLayout.laneCount * LANE_STEP);
    const isSearchingWithoutMetadataMatches =
        hasSearchFilter &&
        displayedCommitIndexes.length === 0 &&
        isSearchingCommitMessages;

    const counterText = searchText && !isSearchEligible
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
            className="fixed inset-x-0 bottom-0 top-8.5 z-50 flex items-center justify-center bg-crust/75 p-4 backdrop-blur-xs animate-in fade-in duration-150"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="git-graph-title"
                className="flex h-[82vh] max-h-[calc(100vh-5rem)] w-[96vw] max-w-[1600px] flex-col overflow-hidden border border-surface0 bg-mantle shadow-2xl animate-in zoom-in-95 duration-150"
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
