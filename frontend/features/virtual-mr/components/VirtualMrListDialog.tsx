import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GitPullRequest } from '../../../common/components/icons/GitPullRequest';
import { Loader2 } from '../../../common/components/icons/Loader2';
import { Plus } from '../../../common/components/icons/Plus';
import { X } from '../../../common/components/icons/X';
import type { CustomSelectOption } from '../../../common/types/CustomSelectOption';
import { formatRecentTime } from '../../../common/utils/dateTime';
import * as botStoreModule from '../../ai/store/useBotReviewersStore';
import { useGitStore } from '../../git/store/useGitStore';
import { useVirtualMrStore } from '../store/useVirtualMrStore';
import type { MrFilter } from '../types/MrFilter';
import type { MrSort } from '../types/MrSort';
import type { SortDirection } from '../types/SortDirection';
import type { VirtualMrListDialogProps } from '../types/VirtualMrListDialogProps';
import type { VirtualMrSession } from '../types/VirtualMrSession';
import {
  getVirtualMrSearchHighlights,
  getVirtualMrSearchSuggestions,
  matchesVirtualMrSearch,
  type VirtualMrSearchSuggestion,
} from '../utils/virtualMrSearch';
import { buildMrSequenceMap } from '../utils/virtualMrSequence';
import { VirtualMrListItem } from './list/VirtualMrListItem';
import { VirtualMrPaginationToolbar } from './list/VirtualMrPaginationToolbar';
import { VirtualMrSearchBox } from './list/VirtualMrSearchBox';

const SORT_OPTIONS: CustomSelectOption<MrSort>[] = [
  { value: 'updated', label: 'Recently updated' },
  { value: 'created', label: 'Creation date' },
  { value: 'title', label: 'Title' },
];

const PAGE_SIZE_OPTIONS: CustomSelectOption<string>[] = [
  { value: '20', label: '20 / page' },
  { value: '50', label: '50 / page' },
  { value: '100', label: '100 / page' },
];

const hasStatus = (session: VirtualMrSession, status: Exclude<MrFilter, 'all'>) =>
  session.status === status;

const BOT_DEFAULT_EMOJIS: Record<string, string> = {
  security: '🛡️',
  performance: '⚡',
  architecture: '🏛️',
  style: '🎨',
  test: '🧪',
  documentation: '📚',
};

export const VirtualMrListDialog: React.FC<VirtualMrListDialogProps> = ({ inline = false }) => {
  const { currentRepo, showToast, setBranchComparison } = useGitStore();
  const {
    sessions,
    isLoadingSessions,
    isMrListOpen,
    setIsMrListOpen,
    switchSession,
    openNewMrDraft,
  } = useVirtualMrStore();
  const [activeFilter, setActiveFilter] = useState<MrFilter>('open');
  const [sortBy, setSortBy] = useState<MrSort>('updated');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState('20');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchCaret, setSearchCaret] = useState(0);
  const [searchScrollLeft, setSearchScrollLeft] = useState(0);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Optional global reviewer bots metadata
  const globalReviewers = useMemo(() => {
    try {
      return botStoreModule?.useBotReviewersStore?.getState?.()?.globalReviewers || [];
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    if (!isMrListOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMrListOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMrListOpen, setIsMrListOpen]);

  // Compute persistent sequence map for MR IDs (!1, !2, !3...) based on repository creation order
  const sessionSequenceMap = useMemo(() => buildMrSequenceMap(sessions), [sessions]);

  const counts = useMemo(
    () => ({
      open: sessions.filter((session) => hasStatus(session, 'open')).length,
      resolved: sessions.filter((session) => hasStatus(session, 'resolved')).length,
      closed: sessions.filter((session) => hasStatus(session, 'closed')).length,
      all: sessions.length,
    }),
    [sessions]
  );

  const visibleSessions = useMemo(() => {
    const filtered = sessions.filter((session) => {
      if (activeFilter !== 'all' && !hasStatus(session, activeFilter)) return false;
      return matchesVirtualMrSearch(session, searchTerm);
    });

    return filtered.sort((first, second) => {
      let comparison = 0;
      if (sortBy === 'title') {
        comparison = first.title.localeCompare(second.title, undefined, {
          sensitivity: 'base',
        });
      } else {
        const firstTime =
          new Date(sortBy === 'created' ? first.createdAt : first.updatedAt).getTime() || 0;
        const secondTime =
          new Date(sortBy === 'created' ? second.createdAt : second.updatedAt).getTime() || 0;
        comparison = firstTime - secondTime;
      }

      if (comparison === 0) comparison = first.id.localeCompare(second.id);
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [activeFilter, sessions, searchTerm, sortBy, sortDirection]);

  const parsedPageSize = parseInt(pageSize, 10) || 20;
  const pageCount = Math.max(1, Math.ceil(visibleSessions.length / parsedPageSize));
  const page = Math.min(currentPage, pageCount);
  const pageOffset = (page - 1) * parsedPageSize;
  const pagedSessions = useMemo(
    () => visibleSessions.slice(pageOffset, pageOffset + parsedPageSize),
    [visibleSessions, pageOffset, parsedPageSize]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter, searchTerm, sortBy, sortDirection, pageSize, currentRepo?.id]);

  useEffect(() => {
    if (currentPage > pageCount) setCurrentPage(pageCount);
  }, [currentPage, pageCount]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [page]);

  const searchHighlights = useMemo(() => getVirtualMrSearchHighlights(searchTerm), [searchTerm]);

  const searchSuggestions = useMemo(
    () => (isSearchFocused ? getVirtualMrSearchSuggestions(searchTerm, searchCaret, sessions) : []),
    [isSearchFocused, searchCaret, searchTerm, sessions]
  );

  useEffect(() => {
    setActiveSuggestionIndex(0);
  }, [searchSuggestions.length, searchTerm]);

  if ((!inline && !isMrListOpen) || !currentRepo) return null;

  const handleSelect = async (sessionId: string) => {
    const session = sessions.find((item) => item.id === sessionId);
    if (!session) return;
    try {
      await setBranchComparison(session.baseBranch, session.compareBranch);
      switchSession(sessionId);
      setIsMrListOpen(false);
      showToast(`Opened Virtual MR: ${session.title}`);
    } catch (error) {
      showToast(
        `Could not open branches for ${session.title}: ${error instanceof Error ? error.message : String(error)}`,
        'error'
      );
    }
  };

  const filters: { id: MrFilter; label: string }[] = [
    { id: 'open', label: 'Open' },
    { id: 'resolved', label: 'Resolved' },
    { id: 'closed', label: 'Closed' },
    { id: 'all', label: 'All' },
  ];

  const applySearchSuggestion = (suggestion: VirtualMrSearchSuggestion) => {
    const input = searchInputRef.current;
    const caret = input?.selectionStart ?? searchTerm.length;
    const beforeCaret = searchTerm.slice(0, caret);
    const tokenStart = beforeCaret.length - (beforeCaret.match(/\S*$/)?.[0].length ?? 0);
    const afterCaret = searchTerm.slice(caret);
    const nextWhitespace = afterCaret.search(/\s/);
    const tokenEnd = nextWhitespace < 0 ? searchTerm.length : caret + nextWhitespace;
    const left = searchTerm.slice(0, tokenStart);
    const right = searchTerm.slice(tokenEnd);
    const value = suggestion.value.includes(' ')
      ? `"${suggestion.value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
      : suggestion.value;
    const replacement =
      suggestion.kind === 'field' ? `${suggestion.field}:` : `${suggestion.field}:${value}`;
    const separator = suggestion.kind === 'value' && (!right || !/^\s/.test(right)) ? ' ' : '';
    const nextQuery = `${left}${replacement}${separator}${right}`;
    const nextCaret = left.length + replacement.length + separator.length;

    setSearchTerm(nextQuery);
    setSearchCaret(nextCaret);
    setIsSearchFocused(true);
    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.setSelectionRange(nextCaret, nextCaret);
      setSearchCaret(nextCaret);
    });
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' && searchSuggestions.length > 0) {
      event.preventDefault();
      setActiveSuggestionIndex((index) => (index + 1) % searchSuggestions.length);
    } else if (event.key === 'ArrowUp' && searchSuggestions.length > 0) {
      event.preventDefault();
      setActiveSuggestionIndex(
        (index) => (index - 1 + searchSuggestions.length) % searchSuggestions.length
      );
    } else if (event.key === 'Enter' && searchSuggestions[activeSuggestionIndex]) {
      event.preventDefault();
      applySearchSuggestion(searchSuggestions[activeSuggestionIndex]);
    } else if (event.key === 'Escape' && isSearchFocused && searchSuggestions.length > 0) {
      event.preventDefault();
      event.stopPropagation();
      setIsSearchFocused(false);
    }
  };

  return (
    <div
      className={
        inline
          ? 'flex h-full min-h-0 w-full flex-col bg-crust'
          : 'fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-8'
      }
      role={inline ? undefined : 'presentation'}
      onMouseDown={
        inline
          ? undefined
          : (event) => {
              if (event.target === event.currentTarget) setIsMrListOpen(false);
            }
      }
    >
      <section
        aria-labelledby="virtual-mr-list-title"
        aria-modal={inline ? undefined : true}
        className={`flex w-full flex-col border border-surface1 bg-mantle text-text ${
          inline ? 'min-h-0 flex-1' : 'max-w-5xl max-h-[calc(100vh-4rem)] shadow-2xl'
        }`}
        role={inline ? 'region' : 'dialog'}
      >
        <header className="flex items-start justify-between gap-4 border-b border-surface0 px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-brand">
              <GitPullRequest className="h-4 w-4 shrink-0" />
              <h2 id="virtual-mr-list-title" className="text-base font-semibold text-text">
                Merge requests
              </h2>
              <span className="border border-surface1 bg-surface0 px-1.5 py-0.5 font-mono text-[10px] text-subtext0">
                {sessions.length}
              </span>
            </div>
            <p className="mt-1 truncate text-xs text-subtext0" title={currentRepo.local_path}>
              {currentRepo.name} · {currentRepo.local_path}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setIsMrListOpen(false);
                void openNewMrDraft();
              }}
              className="flex items-center gap-1.5 bg-primary px-2.5 py-1.5 text-xs font-semibold text-on-accent hover:bg-primary/90 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create Merge Request</span>
            </button>
            {!inline && (
              <button
                type="button"
                onClick={() => setIsMrListOpen(false)}
                className="shrink-0 p-1 text-subtext0 hover:bg-surface0 hover:text-text cursor-pointer"
                title="Close merge request list"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </header>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface0 px-5 py-3">
          <div
            className="flex items-center gap-1 border border-surface1 bg-crust p-0.5"
            role="tablist"
            aria-label="Filter merge requests"
          >
            {filters.map((filter) => (
              <button
                key={filter.id}
                id={`virtual-mr-filter-${filter.id}`}
                type="button"
                role="tab"
                aria-selected={activeFilter === filter.id}
                onClick={() => setActiveFilter(filter.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors cursor-pointer ${
                  activeFilter === filter.id
                    ? 'bg-surface2 text-text font-semibold'
                    : 'text-subtext1 hover:bg-surface0 hover:text-text'
                }`}
              >
                <span>{filter.label}</span>
                <span className="font-mono text-[10px] text-subtext0">{counts[filter.id]}</span>
              </button>
            ))}
          </div>

          <VirtualMrSearchBox
            searchScrollLeft={searchScrollLeft}
            searchHighlights={searchHighlights}
            searchInputRef={searchInputRef}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            setSearchCaret={setSearchCaret}
            setSearchScrollLeft={setSearchScrollLeft}
            setIsSearchFocused={setIsSearchFocused}
            handleSearchKeyDown={handleSearchKeyDown}
            inline={inline}
            searchSuggestions={searchSuggestions}
            activeSuggestionIndex={activeSuggestionIndex}
            applySearchSuggestion={applySearchSuggestion}
            sortBy={sortBy}
            setSortBy={setSortBy}
            setSortDirection={setSortDirection}
            SORT_OPTIONS={SORT_OPTIONS}
            sortDirection={sortDirection}
          />
        </div>

        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto">
          {isLoadingSessions ? (
            <div className="flex items-center justify-center gap-2 py-14 text-xs text-subtext0">
              <Loader2 className="h-4 w-4 animate-spin text-brand" />
              <span>Loading saved merge requests…</span>
            </div>
          ) : visibleSessions.length > 0 ? (
            <div className="divide-y divide-surface0">
              {pagedSessions.map((session) => {
                const statusLabel = session.status[0].toUpperCase() + session.status.slice(1);
                const updatedLabel = formatRecentTime(session.updatedAt) || 'just now';
                const createdLabel = formatRecentTime(session.createdAt) || 'just now';
                const sequenceNumber = sessionSequenceMap.get(session.id) ?? 1;

                return (
                  <VirtualMrListItem
                    key={session.id}
                    session={session}
                    handleSelect={handleSelect}
                    statusLabel={statusLabel}
                    sequenceNumber={sequenceNumber}
                    createdLabel={createdLabel}
                    globalReviewers={globalReviewers}
                    BOT_DEFAULT_EMOJIS={BOT_DEFAULT_EMOJIS}
                    updatedLabel={updatedLabel}
                  />
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center px-6 py-14 text-center">
              <GitPullRequest className="mb-3 h-7 w-7 text-subtext0" />
              <h3 className="text-sm font-semibold text-text">
                {searchTerm.trim()
                  ? 'No matching merge requests'
                  : activeFilter === 'closed'
                    ? 'No closed merge requests'
                    : activeFilter === 'resolved'
                      ? 'No resolved merge requests'
                      : activeFilter === 'open'
                        ? 'No open merge requests'
                        : 'No merge requests yet'}
              </h3>
              <p className="mt-1 max-w-sm text-xs leading-relaxed text-subtext0">
                {searchTerm.trim()
                  ? 'Try another title, branch, description, or label.'
                  : 'Virtual MRs are saved with this repository and will be here when you open it again.'}
              </p>
              {!searchTerm.trim() && (activeFilter === 'open' || activeFilter === 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMrListOpen(false);
                    void openNewMrDraft();
                  }}
                  className="mt-4 border border-brand bg-brand px-3 py-1.5 text-xs font-semibold text-on-accent hover:bg-brand/90 cursor-pointer"
                >
                  Create Virtual MR
                </button>
              )}
            </div>
          )}
        </div>

        <VirtualMrPaginationToolbar
          isLoadingSessions={isLoadingSessions}
          visibleSessions={visibleSessions}
          pageOffset={pageOffset}
          pagedSessions={pagedSessions}
          pageSize={pageSize}
          setPageSize={setPageSize}
          PAGE_SIZE_OPTIONS={PAGE_SIZE_OPTIONS}
          pageCount={pageCount}
          setCurrentPage={setCurrentPage}
          page={page}
        />
      </section>
    </div>
  );
};
