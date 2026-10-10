import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ChevronLeft } from '../../../common/components/icons/ChevronLeft';
import { ChevronRight } from '../../../common/components/icons/ChevronRight';
import { Copy } from '../../../common/components/icons/Copy';
import { GitBranch } from '../../../common/components/icons/GitBranch';
import { RotateCw } from '../../../common/components/icons/RotateCw';
import { Search } from '../../../common/components/icons/Search';
import { X } from '../../../common/components/icons/X';
import { formatDateTime } from '@/common/utils/dateTime';
import { CommitAuthorAvatar } from './CommitAuthorAvatar';
import { useGitStore } from '../store/useGitStore';
import type { GitGraphModalProps } from '../types/GitGraphModalProps';
import type { GitGraph } from '../types/GitGraph';
import type { CommitMessageSearchResult } from '../types/CommitMessageSearchResult';
import type { CommitContextMenuState } from '../types/CommitContextMenuState';
import type { GraphRowLayout } from '../types/GraphRowLayout';
import { CommitHashContextMenu } from './CommitHashContextMenu';

const LANE_STEP = 18;

const NODE_X_OFFSET = 12;

const ROW_HEIGHT = 36;

const LANE_COLORS = [
    'var(--color-brand)',
    'var(--color-blue)',
    'var(--color-teal)',
    'var(--color-green)',
    'var(--color-peach)',
    'var(--color-mauve)',
    'var(--color-sky)',
    'var(--color-yellow)',
];

function laneX(lane: number) {
    return NODE_X_OFFSET + lane * LANE_STEP;
}

function referenceColor(reference: string) {
    const branchName = reference.replace(/^HEAD -> /, '');
    let hash = 0x811c9dc5;
    for (const character of branchName) {
        hash ^= character.codePointAt(0) ?? 0;
        hash = Math.imul(hash, 0x01000193);
    }
    return LANE_COLORS[(hash >>> 0) % LANE_COLORS.length];
}

async function copyTextToClipboard(value: string) {
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(value);
            return;
        }
    } catch {
        // Some desktop webviews reject Clipboard API access; try the legacy path.
    }

    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    if (!copied) throw new Error('Clipboard access was denied');
}

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
                <header className="flex shrink-0 items-center justify-between border-b border-surface0 bg-base/60 px-5 py-3.5">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-surface1 bg-surface0 text-brand">
                            <GitBranch className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                            <h2
                                id="git-graph-title"
                                className="text-sm font-bold text-text"
                            >
                                Git Graph
                            </h2>
                            <p className="truncate text-[11px] text-subtext0">
                                Current branch:{' '}
                                <span className="font-mono font-semibold text-text">
                                    {graph?.branch || 'Loading…'}
                                </span>
                                {graph?.is_detached && (
                                    <span className="ml-1">(detached)</span>
                                )}
                            </p>
                        </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                        <button
                            type="button"
                            onClick={() =>
                                setRefreshToken((token) => token + 1)
                            }
                            disabled={isLoading}
                            aria-label="Refresh Git Graph"
                            title="Refresh Git Graph"
                            className="flex h-8 w-8 items-center justify-center text-subtext0 transition-colors hover:bg-surface0 hover:text-text disabled:opacity-40"
                        >
                            <RotateCw
                                className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
                            />
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Close Git Graph"
                            title="Close (Esc)"
                            className="flex h-8 w-8 items-center justify-center text-subtext0 transition-colors hover:bg-surface0 hover:text-text"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </header>

                <div className="flex shrink-0 items-center gap-1.5 border-b border-surface0 px-3 py-2">
                    <label className="flex min-w-0 flex-1 items-center gap-2 border border-surface1 bg-crust px-2.5 py-1.5 text-subtext0 focus-within:border-brand">
                        <Search className="h-3.5 w-3.5 shrink-0" />
                        <input
                            type="search"
                            value={query}
                            onChange={(event) => {
                                setQuery(event.target.value);
                                setActiveMatchIndex(0);
                            }}
                            onKeyDown={handleSearchKeyDown}
                            placeholder="Search commits by message, subject, author name or email, branch name, tag refs, hash…"
                            aria-label="Search commits"
                            className="git-graph-search-input min-w-0 flex-1 bg-transparent text-xs text-text outline-none placeholder:text-subtext0"
                        />
                        <button
                            type="button"
                            onClick={() => {
                                setCaseSensitive((value) => !value);
                                setActiveMatchIndex(0);
                            }}
                            aria-pressed={caseSensitive}
                            title={
                                caseSensitive
                                    ? 'Case-sensitive search on'
                                    : 'Match case'
                            }
                            className={`px-1 text-[10px] font-semibold transition-colors ${caseSensitive ? 'text-brand' : 'text-subtext0 hover:text-text'}`}
                        >
                            Aa
                        </button>
                    </label>
                    <button
                        type="button"
                        onClick={() => navigateMatches(-1)}
                        disabled={
                            isSearchDebouncing || !matchingCommitIndexes.length
                        }
                        aria-label="Previous search result"
                        title="Previous match (Shift+Enter)"
                        className="flex h-7 w-6 items-center justify-center text-subtext0 hover:bg-surface0 hover:text-text disabled:opacity-35"
                    >
                        <ChevronLeft className="h-3 w-3" />
                    </button>
                    <button
                        type="button"
                        onClick={() => navigateMatches(1)}
                        disabled={
                            isSearchDebouncing || !matchingCommitIndexes.length
                        }
                        aria-label="Next search result"
                        title="Next match (Enter)"
                        className="flex h-7 w-6 items-center justify-center text-subtext0 hover:bg-surface0 hover:text-text disabled:opacity-35"
                    >
                        <ChevronRight className="h-3 w-3" />
                    </button>
                    <span
                        className="w-12 text-center text-[10px] tabular-nums text-subtext0"
                        aria-live="polite"
                        title={messageSearchError || undefined}
                    >
                        {searchText && !isSearchEligible
                            ? '3+'
                            : isSearchDebouncing
                              ? '…/…'
                              : hasSearchFilter
                                ? isSearchingCommitMessages &&
                                  matchingCommitIndexes.length === 0
                                    ? '…/…'
                                    : `${currentMatchIndex >= 0 ? currentMatchIndex + 1 : 0}/${matchingCommitIndexes.length}`
                                : null}
                    </span>
                </div>

                <div className="flex min-h-0 flex-1 overflow-hidden">
                    <div className="min-w-0 flex-1 overflow-auto">
                        {isLoading || (!graph && !error) ? (
                            <div className="flex h-48 items-center justify-center gap-2 text-xs text-subtext0">
                                <RotateCw className="h-4 w-4 animate-spin" />
                                Loading commit graph…
                            </div>
                        ) : error ? (
                            <div className="m-4 border border-red bg-red px-4 py-3 text-xs text-white">
                                Could not load the Git graph: {error}
                            </div>
                        ) : hasSearchFilter &&
                          displayedCommitIndexes.length === 0 ? (
                            <div className="flex h-48 flex-col items-center justify-center gap-2 px-6 text-center">
                                {isSearchingWithoutMetadataMatches ? (
                                    <>
                                        <RotateCw className="h-5 w-5 animate-spin text-subtext1" />
                                        <p className="text-sm font-semibold text-text">
                                            Searching commits…
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <Search className="h-6 w-6 text-subtext1" />
                                        <p className="text-sm font-semibold text-text">
                                            No matching commits
                                        </p>
                                        <p className="break-words text-xs text-subtext0">
                                            No commits match “{query.trim()}”.
                                            Try another search term.
                                        </p>
                                    </>
                                )}
                            </div>
                        ) : !hasSearchFilter && commits.length === 0 ? (
                            <div className="flex h-48 flex-col items-center justify-center gap-2 text-center">
                                <GitBranch className="h-6 w-6 text-subtext1" />
                                <p className="text-sm font-semibold text-text">
                                    No commits yet
                                </p>
                                <p className="text-xs text-subtext0">
                                    The current branch does not have any commits
                                    to display.
                                </p>
                            </div>
                        ) : (
                            <table className="w-full min-w-[920px] table-fixed border-collapse text-xs">
                                <colgroup>
                                    <col style={{ width: graphWidth }} />
                                    <col />
                                    <col style={{ width: 178 }} />
                                    <col style={{ width: 150 }} />
                                    <col style={{ width: 92 }} />
                                </colgroup>
                                <thead className="sticky top-0 z-10 bg-mantle text-left text-[11px] font-semibold text-subtext1 shadow-sm">
                                    <tr className="h-8 border-b border-surface0">
                                        <th className="px-3">Graph</th>
                                        <th className="px-2">Description</th>
                                        <th className="px-2">Date</th>
                                        <th className="px-2">Author</th>
                                        <th className="px-2">Commit</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayedCommitIndexes.map((index) => {
                                        const commit = commits[index];
                                        const row = graphLayout.rows[index];
                                        const color =
                                            LANE_COLORS[
                                                row.lane % LANE_COLORS.length
                                            ];
                                        const isMatch =
                                            matchingCommitIndexes.includes(
                                                index,
                                            );
                                        const isActiveMatch =
                                            currentMatchCommit?.hash ===
                                            commit.hash;

                                        return (
                                            <tr
                                                key={commit.hash}
                                                ref={(element) => {
                                                    if (element)
                                                        commitRows.current.set(
                                                            commit.hash,
                                                            element,
                                                        );
                                                    else
                                                        commitRows.current.delete(
                                                            commit.hash,
                                                        );
                                                }}
                                                onClick={() =>
                                                    setSelectedCommitHash(
                                                        commit.hash,
                                                    )
                                                }
                                                onContextMenu={(event) => {
                                                    event.preventDefault();
                                                    setSelectedCommitHash(
                                                        commit.hash,
                                                    );
                                                    setCommitContextMenu({
                                                        x: event.clientX,
                                                        y: event.clientY,
                                                        hash: commit.hash,
                                                    });
                                                }}
                                                onKeyDown={(event) => {
                                                    if (
                                                        event.key === 'Enter' ||
                                                        event.key === ' '
                                                    ) {
                                                        event.preventDefault();
                                                        setSelectedCommitHash(
                                                            commit.hash,
                                                        );
                                                    }
                                                }}
                                                aria-selected={
                                                    selectedCommitHash ===
                                                    commit.hash
                                                }
                                                tabIndex={0}
                                                className={`h-9 cursor-pointer border-b border-surface0/50 outline-none transition-colors hover:bg-surface0/70 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-brand ${
                                                    selectedCommitHash ===
                                                    commit.hash
                                                        ? 'bg-brand/20'
                                                        : isActiveMatch
                                                          ? 'bg-brand/15'
                                                          : isMatch
                                                            ? 'bg-brand/10'
                                                            : ''
                                                }`}
                                            >
                                                <td className="px-3 py-0">
                                                    <svg
                                                        width={graphWidth - 24}
                                                        height={ROW_HEIGHT}
                                                        viewBox={`0 0 ${graphWidth - 24} ${ROW_HEIGHT}`}
                                                        role="img"
                                                        aria-label={`Commit graph lane ${row.lane + 1}`}
                                                        className="block"
                                                    >
                                                        {hasSearchFilter ? (
                                                            <circle
                                                                cx={laneX(
                                                                    row.lane,
                                                                )}
                                                                cy="18"
                                                                r="4"
                                                                fill={color}
                                                            />
                                                        ) : (
                                                            <>
                                                                {row.throughLanes.map(
                                                                    (lane) => (
                                                                        <path
                                                                            key={`through-${lane}`}
                                                                            d={`M ${laneX(lane)} 0 V ${ROW_HEIGHT}`}
                                                                            fill="none"
                                                                            stroke={
                                                                                LANE_COLORS[
                                                                                    lane %
                                                                                        LANE_COLORS.length
                                                                                ]
                                                                            }
                                                                            strokeWidth="2"
                                                                        />
                                                                    ),
                                                                )}
                                                                {row.hasIncomingEdge && (
                                                                    <path
                                                                        d={`M ${laneX(row.lane)} 0 V 18`}
                                                                        fill="none"
                                                                        stroke={
                                                                            color
                                                                        }
                                                                        strokeWidth="2"
                                                                    />
                                                                )}
                                                                {row.parentLanes.map(
                                                                    (
                                                                        parentLane,
                                                                        parentIndex,
                                                                    ) => {
                                                                        const startX =
                                                                            laneX(
                                                                                row.lane,
                                                                            );
                                                                        const endX =
                                                                            laneX(
                                                                                parentLane,
                                                                            );
                                                                        const path =
                                                                            startX ===
                                                                            endX
                                                                                ? `M ${startX} 18 V ${ROW_HEIGHT}`
                                                                                : `M ${startX} 18 C ${startX} 27, ${endX} 27, ${endX} ${ROW_HEIGHT}`;
                                                                        return (
                                                                            <path
                                                                                key={`parent-${parentIndex}-${parentLane}`}
                                                                                d={
                                                                                    path
                                                                                }
                                                                                fill="none"
                                                                                stroke={
                                                                                    LANE_COLORS[
                                                                                        parentLane %
                                                                                            LANE_COLORS.length
                                                                                    ]
                                                                                }
                                                                                strokeWidth="2"
                                                                            />
                                                                        );
                                                                    },
                                                                )}
                                                                <circle
                                                                    cx={laneX(
                                                                        row.lane,
                                                                    )}
                                                                    cy="18"
                                                                    r="3.5"
                                                                    fill={color}
                                                                />
                                                            </>
                                                        )}
                                                    </svg>
                                                </td>
                                                <td className="overflow-hidden px-2 py-0">
                                                    <div className="flex min-w-0 items-center gap-1.5">
                                                        {commit.refs.map(
                                                            (reference) => (
                                                                <span
                                                                    key={
                                                                        reference
                                                                    }
                                                                    title={
                                                                        reference
                                                                    }
                                                                    style={{
                                                                        color: referenceColor(
                                                                            reference,
                                                                        ),
                                                                        borderColor:
                                                                            referenceColor(
                                                                                reference,
                                                                            ),
                                                                        backgroundColor: `color-mix(in srgb, ${referenceColor(reference)} 12%, var(--color-surface0))`,
                                                                    }}
                                                                    className="max-w-48 shrink-0 truncate border px-1.5 py-0.5 font-mono text-[10px]"
                                                                >
                                                                    {reference}
                                                                </span>
                                                            ),
                                                        )}
                                                        <span
                                                            className="truncate text-text"
                                                            title={
                                                                commit.subject
                                                            }
                                                        >
                                                            {commit.subject ||
                                                                '(no commit message)'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td
                                                    className="truncate px-2 py-0 text-subtext1"
                                                    title={commit.authored_date}
                                                >
                                                    {formatDateTime(
                                                        commit.authored_date,
                                                    ) || '—'}
                                                </td>
                                                <td
                                                    className="overflow-hidden px-2 py-0 text-subtext1"
                                                    title={commit.author_name}
                                                >
                                                    <div className="flex min-w-0 items-center gap-1.5">
                                                        <CommitAuthorAvatar
                                                            name={
                                                                commit.author_name ||
                                                                'Unknown'
                                                            }
                                                            email={
                                                                commit.author_email
                                                            }
                                                            size={22}
                                                        />
                                                        <span className="truncate">
                                                            {commit.author_name ||
                                                                'Unknown'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td
                                                    className="px-2 py-0 font-mono text-subtext1"
                                                    title={commit.hash}
                                                >
                                                    {commit.short_hash}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>

                    <aside className="flex w-[min(36%,440px)] min-w-[300px] shrink-0 flex-col border-l border-surface0 bg-base/40">
                        {selectedCommit ? (
                            <>
                                <div className="shrink-0 border-b border-surface0 px-4 py-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <h3 className="text-[11px] font-bold uppercase tracking-wider text-subtext0">
                                            Commit details
                                        </h3>
                                        <span className="shrink-0 font-mono text-[10px] text-subtext0">
                                            {selectedCommit.short_hash}
                                        </span>
                                    </div>
                                    <p className="mt-2 break-words text-sm font-semibold leading-5 text-text">
                                        {selectedCommit.subject ||
                                            '(no commit message)'}
                                    </p>
                                    {selectedCommit.refs.length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-1">
                                            {selectedCommit.refs.map(
                                                (reference) => (
                                                    <span
                                                        key={reference}
                                                        style={{
                                                            color: referenceColor(
                                                                reference,
                                                            ),
                                                            borderColor:
                                                                referenceColor(
                                                                    reference,
                                                                ),
                                                            backgroundColor: `color-mix(in srgb, ${referenceColor(reference)} 12%, var(--color-surface0))`,
                                                        }}
                                                        className="max-w-full truncate border px-1.5 py-0.5 font-mono text-[10px]"
                                                    >
                                                        {reference}
                                                    </span>
                                                ),
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
                                    <dl className="space-y-3 text-xs">
                                        <div>
                                            <dt className="text-[10px] font-semibold uppercase tracking-wide text-subtext0">
                                                Author
                                            </dt>
                                            <dd className="mt-2 flex min-w-0 items-center gap-3 text-text">
                                                <CommitAuthorAvatar
                                                    name={
                                                        selectedCommit.author_name ||
                                                        'Unknown'
                                                    }
                                                    email={
                                                        selectedCommit.author_email
                                                    }
                                                />
                                                <span className="min-w-0 break-words">
                                                    {selectedCommit.author_name ||
                                                        'Unknown'}
                                                    {selectedCommit.author_email && (
                                                        <span className="block break-all text-subtext0">
                                                            {
                                                                selectedCommit.author_email
                                                            }
                                                        </span>
                                                    )}
                                                </span>
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-[10px] font-semibold uppercase tracking-wide text-subtext0">
                                                Date
                                            </dt>
                                            <dd className="mt-0.5 text-text">
                                                {formatDateTime(
                                                    selectedCommit.authored_date,
                                                ) || '—'}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-[10px] font-semibold uppercase tracking-wide text-subtext0">
                                                Commit
                                            </dt>
                                            <dd className="mt-0.5 flex min-w-0 items-start gap-2 font-mono text-[11px] text-text">
                                                <span className="min-w-0 flex-1 break-all">
                                                    {selectedCommit.hash}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        void handleCopyCommitHash(
                                                            selectedCommit.hash,
                                                        )
                                                    }
                                                    aria-label="Copy commit hash"
                                                    title="Copy commit hash"
                                                    className="flex h-6 w-6 shrink-0 items-center justify-center text-subtext0 hover:bg-surface0 hover:text-text focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand"
                                                >
                                                    <Copy className="h-3.5 w-3.5" />
                                                </button>
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-[10px] font-semibold uppercase tracking-wide text-subtext0">
                                                Parents
                                            </dt>
                                            <dd className="mt-0.5 space-y-1 font-mono text-[10px] text-text">
                                                {selectedCommit.parents.length >
                                                0 ? (
                                                    selectedCommit.parents.map(
                                                        (parent) => (
                                                            <div
                                                                key={parent}
                                                                className="break-all"
                                                            >
                                                                {parent}
                                                            </div>
                                                        ),
                                                    )
                                                ) : (
                                                    <span className="text-subtext0">
                                                        Root commit
                                                    </span>
                                                )}
                                            </dd>
                                        </div>
                                    </dl>

                                    <div className="mt-5 border-t border-surface0 pt-3">
                                        <h4 className="text-[10px] font-semibold uppercase tracking-wide text-subtext0">
                                            Commit message
                                        </h4>
                                        <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-text select-text">
                                            {isLoadingCommitMessage
                                                ? 'Loading commit message…'
                                                : commitMessageError
                                                  ? `Could not load commit message: ${commitMessageError}`
                                                  : selectedCommitMessage ||
                                                    '(empty message)'}
                                        </pre>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                                <GitBranch className="h-5 w-5 text-subtext1" />
                                <p className="mt-2 text-xs font-semibold text-text">
                                    Select a commit
                                </p>
                                <p className="mt-1 text-[11px] leading-4 text-subtext0">
                                    Commit message, author, parents, and refs
                                    will appear here.
                                </p>
                            </div>
                        )}
                    </aside>
                </div>

                <footer className="flex shrink-0 items-center justify-between border-t border-surface0 px-5 py-2.5 text-[10px] text-subtext0">
                    <span>
                        {hasSearchFilter
                            ? `${displayedCommitIndexes.length} search result${displayedCommitIndexes.length === 1 ? '' : 's'}`
                            : graph?.truncated
                              ? 'Showing the latest 200 commits'
                              : `${commits.length} commits`}
                        {' · '}Read-only history for the checked-out branch.
                    </span>
                    <span>
                        Press Enter to find next · Shift+Enter to find previous
                    </span>
                </footer>
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
