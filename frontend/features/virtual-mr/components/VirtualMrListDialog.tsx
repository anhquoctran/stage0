import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CustomSelect } from '../../../common/components/CustomSelect';
import { CheckCircle2 } from '../../../common/components/icons/CheckCircle2';
import { ChevronLeft } from '../../../common/components/icons/ChevronLeft';
import { ChevronRight } from '../../../common/components/icons/ChevronRight';
import { GitPullRequest } from '../../../common/components/icons/GitPullRequest';
import { Loader2 } from '../../../common/components/icons/Loader2';
import { MessageSquare } from '../../../common/components/icons/MessageSquare';
import { Plus } from '../../../common/components/icons/Plus';
import { Search } from '../../../common/components/icons/Search';
import { SortAscending } from '../../../common/components/icons/SortAscending';
import { SortDescending } from '../../../common/components/icons/SortDescending';
import { X } from '../../../common/components/icons/X';
import type { CustomSelectOption } from '../../../common/types/CustomSelectOption';
import { formatDateTime, formatRecentTime } from '../../../common/utils/dateTime';
import { useGitStore } from '../../git/store/useGitStore';
import { useVirtualMrStore } from '../store/useVirtualMrStore';
import type { VirtualMrSession } from '../types/VirtualMrSession';
import * as botStoreModule from '../../ai/store/useBotReviewersStore';
import {
  getVirtualMrSearchHighlights,
  getVirtualMrSearchSuggestions,
  matchesVirtualMrSearch,
  type VirtualMrSearchSuggestion,
} from '../utils/virtualMrSearch';
import type { MrFilter } from '../types/MrFilter';
import type { MrSort } from '../types/MrSort';
import type { SortDirection } from '../types/SortDirection';
import type { VirtualMrListDialogProps } from '../types/VirtualMrListDialogProps';
import { SearchSuggestionIcon } from './SearchSuggestionIcon';
import { GitLabAvatar } from './GitLabAvatar';

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

const hasStatus = (session: VirtualMrSession, status: Exclude<MrFilter, 'all'>) => session.status === status;

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
  const sessionSequenceMap = useMemo(() => {
    const sorted = [...sessions].sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime() || 0;
      const timeB = new Date(b.createdAt).getTime() || 0;
      return timeA - timeB || a.id.localeCompare(b.id);
    });
    const map = new Map<string, number>();
    sorted.forEach((session, index) => {
      map.set(session.id, index + 1);
    });
    return map;
  }, [sessions]);

  const counts = useMemo(() => ({
    open: sessions.filter((session) => hasStatus(session, 'open')).length,
    resolved: sessions.filter((session) => hasStatus(session, 'resolved')).length,
    closed: sessions.filter((session) => hasStatus(session, 'closed')).length,
    all: sessions.length,
  }), [sessions]);

  const visibleSessions = useMemo(() => {
    const filtered = sessions.filter((session) => {
      if (activeFilter !== 'all' && !hasStatus(session, activeFilter)) return false;
      return matchesVirtualMrSearch(session, searchTerm);
    });

    return filtered.sort((first, second) => {
      let comparison = 0;
      if (sortBy === 'title') {
        comparison = first.title.localeCompare(second.title, undefined, { sensitivity: 'base' });
      } else {
        const firstTime = new Date(sortBy === 'created' ? first.createdAt : first.updatedAt).getTime() || 0;
        const secondTime = new Date(sortBy === 'created' ? second.createdAt : second.updatedAt).getTime() || 0;
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
  const pagedSessions = useMemo(() => visibleSessions.slice(pageOffset, pageOffset + parsedPageSize), [visibleSessions, pageOffset, parsedPageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter, searchTerm, sortBy, sortDirection, pageSize, currentRepo?.id]);

  useEffect(() => {
    if (currentPage > pageCount) setCurrentPage(pageCount);
  }, [currentPage, pageCount]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [page]);

  const searchHighlights = useMemo(
    () => getVirtualMrSearchHighlights(searchTerm),
    [searchTerm]
  );

  const searchSuggestions = useMemo(
    () => isSearchFocused
      ? getVirtualMrSearchSuggestions(searchTerm, searchCaret, sessions)
      : [],
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
      showToast(`Could not open branches for ${session.title}: ${error instanceof Error ? error.message : String(error)}`, 'error');
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
    const replacement = suggestion.kind === 'field' ? `${suggestion.field}:` : `${suggestion.field}:${value}`;
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
      setActiveSuggestionIndex((index) => (index - 1 + searchSuggestions.length) % searchSuggestions.length);
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
      className={inline
        ? 'flex h-full min-h-0 w-full flex-col bg-crust'
        : 'fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-8'}
      role={inline ? undefined : 'presentation'}
      onMouseDown={inline ? undefined : (event) => {
        if (event.target === event.currentTarget) setIsMrListOpen(false);
      }}
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
              <h2 id="virtual-mr-list-title" className="text-base font-semibold text-text">Merge requests</h2>
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
          <div className="flex items-center gap-1 border border-surface1 bg-crust p-0.5" role="tablist" aria-label="Filter merge requests">
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

          <div className="flex h-8 min-w-[340px] flex-1 items-stretch border border-surface1 bg-crust focus-within:border-brand">
            <div className="relative min-w-0 flex-1">
              <label className="flex h-full items-center gap-2 px-2.5 text-subtext0">
                <Search className="h-3.5 w-3.5 shrink-0" />
                <div className="relative h-full min-w-0 flex-1 overflow-hidden">
                  <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center overflow-hidden">
                    <span
                      className="block w-max whitespace-pre text-xs leading-4 text-text"
                      style={{ transform: `translateX(-${searchScrollLeft}px)` }}
                    >
                      {searchHighlights.map((segment, index) => {
                        if (!segment.isFilter) return <span key={index}>{segment.text}</span>;

                        const separator = segment.text.indexOf(':');
                        return (
                          <span
                            key={index}
                            className="mr-list-search-filter-badge align-baseline"
                          >
                            <span className="text-subtext0">{segment.text.slice(0, separator + 1)}</span>
                            <span className="bg-brand/15 text-brand">{segment.text.slice(separator + 1)}</span>
                          </span>
                        );
                      })}
                    </span>
                  </div>
                  <input
                    ref={searchInputRef}
                    type="search"
                    value={searchTerm}
                    onChange={(event) => {
                      setSearchTerm(event.target.value);
                      setSearchCaret(event.target.selectionStart ?? event.target.value.length);
                      setSearchScrollLeft(event.target.scrollLeft);
                    }}
                    onScroll={(event) => setSearchScrollLeft(event.currentTarget.scrollLeft)}
                    onFocus={(event) => {
                      setIsSearchFocused(true);
                      setSearchCaret(event.currentTarget.selectionStart ?? searchTerm.length);
                    }}
                    onBlur={() => setIsSearchFocused(false)}
                    onClick={(event) => setSearchCaret(event.currentTarget.selectionStart ?? searchTerm.length)}
                    onKeyUp={(event) => setSearchCaret(event.currentTarget.selectionStart ?? searchTerm.length)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="Search MRs or type to filter…"
                    className="mr-list-search-input absolute inset-0 h-full w-full min-w-0 bg-transparent text-xs leading-4 text-transparent caret-text placeholder:text-subtext0 focus:outline-none selection:bg-brand/50 selection:text-text"
                    aria-label="Search merge requests"
                    aria-autocomplete="list"
                    aria-controls={`virtual-mr-${inline ? 'inline' : 'dialog'}-search-suggestions`}
                    aria-expanded={searchSuggestions.length > 0}
                    aria-activedescendant={searchSuggestions.length > 0
                      ? `virtual-mr-${inline ? 'inline' : 'dialog'}-search-suggestion-${activeSuggestionIndex}`
                      : undefined}
                  />
                </div>
              </label>
              {searchSuggestions.length > 0 && (
                <div
                  id={`virtual-mr-${inline ? 'inline' : 'dialog'}-search-suggestions`}
                  className="absolute left-0 top-full z-[120] mt-1 max-h-80 w-[min(26rem,calc(100vw-2rem))] overflow-y-auto border border-surface1 bg-surface0 py-1 text-left shadow-xl"
                  role="listbox"
                  aria-label="Search suggestions"
                >
                  {searchSuggestions.map((suggestion, index) => (
                    <button
                      key={`${suggestion.field}:${suggestion.value}`}
                      id={`virtual-mr-${inline ? 'inline' : 'dialog'}-search-suggestion-${index}`}
                      type="button"
                      role="option"
                      aria-selected={activeSuggestionIndex === index}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        applySearchSuggestion(suggestion);
                      }}
                      className={`flex w-full items-center gap-2.5 px-3 py-2 text-xs transition-colors cursor-pointer ${
                        activeSuggestionIndex === index
                          ? 'bg-surface2 text-text'
                          : 'text-subtext1 hover:bg-surface1 hover:text-text'
                      }`}
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center text-brand">
                        <SearchSuggestionIcon field={suggestion.field} />
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {suggestion.label}
                      </span>
                      <span className="shrink-0 truncate text-[10px] text-subtext0">
                        {suggestion.detail}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex h-full shrink-0 items-center border-l border-surface1">
              <CustomSelect<MrSort>
                value={sortBy}
                onChange={(nextSort) => {
                  setSortBy(nextSort);
                  setSortDirection(nextSort === 'title' ? 'asc' : 'desc');
                }}
                options={SORT_OPTIONS}
                className="mr-list-sort-custom-select h-full"
                buttonClassName="h-full min-w-[140px] max-w-[170px]"
                dropdownWidth="w-40"
                align="left"
                aria-label="Sort merge requests"
              />
            </div>
            <button
              type="button"
              onClick={() => setSortDirection((direction) => direction === 'asc' ? 'desc' : 'asc')}
              className="flex h-full w-8 shrink-0 items-center justify-center border-l border-surface1 bg-surface0 text-text hover:bg-surface1 focus-visible:outline focus-visible:outline-1 focus-visible:outline-brand cursor-pointer"
              aria-label={`Switch to ${sortDirection === 'asc' ? 'descending' : 'ascending'} order`}
              title={`${sortDirection === 'asc' ? 'Ascending' : 'Descending'} order`}
            >
              {sortDirection === 'asc'
                ? <SortAscending className="h-3 w-3" />
                : <SortDescending className="h-3 w-3" />}
            </button>
          </div>
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
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => handleSelect(session.id)}
                    className="group flex w-full items-center justify-between gap-4 px-5 py-3 text-left hover:bg-surface0/60 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand cursor-pointer"
                  >
                    <div className="min-w-0 flex-1 space-y-1.5">
                      {/* Top line: Title (bold) + Status Badge + Assigned Labels */}
                      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="truncate text-sm font-bold text-text group-hover:text-brand" title={session.title}>
                          {session.title}
                        </span>
                        <span className={`inline-flex shrink-0 items-center gap-1 border px-1.5 py-0.5 text-[10px] font-semibold select-none ${
                          session.status === 'closed'
                            ? 'border-surface1 bg-surface0 text-subtext1'
                            : session.status === 'resolved'
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                            : 'border-brand/30 bg-brand/10 text-brand'
                        }`}>
                          {session.status === 'resolved' ? <CheckCircle2 className="h-3 w-3" /> : null}
                          {statusLabel}
                        </span>

                        {/* Assigned labels */}
                        {session.labels.map((label) => (
                          <span
                            key={label.id}
                            className="border border-surface1 bg-surface0/60 px-1.5 py-0.5 text-[10px] font-medium text-subtext0 select-none"
                          >
                            {label.name}
                          </span>
                        ))}
                      </div>

                      {/* Bottom line: Sequence ID, Created Time, Creator + Avatar, Source Branch -> Target Branch */}
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-subtext0">
                        {/* Friendly MR ID (sequence) */}
                        <span className="font-mono font-semibold text-subtext1">
                          !{sequenceNumber}
                        </span>

                        <span className="select-none text-surface2">·</span>

                        {/* Friendly created timestamp & Creator + avatar */}
                        <div className="flex items-center gap-1.5">
                          <span>created {createdLabel} by</span>
                          <GitLabAvatar
                            name={session.assignee.name}
                            email={session.assignee.email}
                            avatarUrl={session.assignee.avatarUrl}
                            size="xs"
                          />
                          <span className="font-medium text-subtext1">{session.assignee.name}</span>
                        </div>

                        <span className="select-none text-surface2">·</span>

                        {/* Source branch -> target branch */}
                        <div className="flex items-center gap-1 font-mono text-[11px] text-subtext1">
                          <span className="max-w-[220px] truncate" title={session.compareBranch}>
                            {session.compareBranch}
                          </span>
                          <span className="text-subtext0">→</span>
                          <span className="max-w-[220px] truncate" title={session.baseBranch}>
                            {session.baseBranch}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right side: Reviewer bot icons, Assignee icon, Discussions count, Friendly updated timestamp */}
                    <div className="flex shrink-0 items-center gap-4 text-xs text-subtext0">
                      {/* Reviewer bot icons */}
                      {session.reviewers.length > 0 && (
                        <div className="flex items-center -space-x-1" title={`${session.reviewers.length} reviewer bot(s)`}>
                          {session.reviewers.map((rev) => {
                            const bot = globalReviewers.find((b) => b.id === rev.agentId);
                            const emoji = bot?.avatarEmoji || BOT_DEFAULT_EMOJIS[rev.agentId] || '🤖';
                            return (
                              <span
                                key={rev.agentId}
                                className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-300 ring-2 ring-mantle flex items-center justify-center text-[10px] shrink-0"
                                title={`${rev.agentName} (AI Reviewer)`}
                              >
                                {emoji}
                              </span>
                            );
                          })}
                        </div>
                      )}

                      {/* Assignee icon */}
                      <div title={`Assignee: ${session.assignee.name}`}>
                        <GitLabAvatar
                          name={session.assignee.name}
                          email={session.assignee.email}
                          avatarUrl={session.assignee.avatarUrl}
                          size="sm"
                        />
                      </div>

                      {/* Discussions count */}
                      {session.discussions.length > 0 && (
                        <span className="inline-flex items-center gap-1 font-mono text-[11px]" title={`${session.discussions.length} discussion(s)`}>
                          <MessageSquare className="h-3.5 w-3.5" />
                          {session.discussions.length}
                        </span>
                      )}

                      {/* Friendly updated timestamp */}
                      <time
                        dateTime={session.updatedAt}
                        title={formatDateTime(session.updatedAt)}
                        className="text-right text-[11px] text-subtext0 min-w-[70px]"
                      >
                        updated {updatedLabel}
                      </time>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center px-6 py-14 text-center">
              <GitPullRequest className="mb-3 h-7 w-7 text-subtext0" />
              <h3 className="text-sm font-semibold text-text">
                {searchTerm.trim() ? 'No matching merge requests' : activeFilter === 'closed' ? 'No closed merge requests' : activeFilter === 'resolved' ? 'No resolved merge requests' : activeFilter === 'open' ? 'No open merge requests' : 'No merge requests yet'}
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

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-surface0 px-5 py-2 text-[10px] text-subtext0">
          <span role="status">
            {isLoadingSessions
              ? 'Loading merge requests…'
              : `Showing ${visibleSessions.length ? pageOffset + 1 : 0}–${pageOffset + pagedSessions.length} of ${visibleSessions.length}`}
          </span>
          <div className="flex items-center gap-3">
            <CustomSelect
              value={pageSize}
              onChange={setPageSize}
              options={PAGE_SIZE_OPTIONS}
              disabled={isLoadingSessions}
              buttonClassName="min-w-[104px]"
              menuClassName="!top-auto bottom-full !mt-0 mb-1.5"
              dropdownWidth="w-32"
              aria-label="Merge requests per page"
            />
            {pageCount > 1 && (
              <nav className="flex items-center gap-1" aria-label="Merge request pagination">
                <button
                  type="button"
                  onClick={() => setCurrentPage(page - 1)}
                  disabled={isLoadingSessions || page === 1}
                  aria-label="Previous page"
                  title="Previous page"
                  className="flex h-7 w-7 items-center justify-center border border-surface1 text-text hover:bg-surface0 focus-visible:outline focus-visible:outline-1 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-35 cursor-pointer"
                >
                  <ChevronLeft className="h-3 w-3" />
                </button>
                <span className="px-2 tabular-nums">Page {page} of {pageCount}</span>
                <button
                  type="button"
                  onClick={() => setCurrentPage(page + 1)}
                  disabled={isLoadingSessions || page === pageCount}
                  aria-label="Next page"
                  title="Next page"
                  className="flex h-7 w-7 items-center justify-center border border-surface1 text-text hover:bg-surface0 focus-visible:outline focus-visible:outline-1 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-35 cursor-pointer"
                >
                  <ChevronRight className="h-3 w-3" />
                </button>
              </nav>
            )}
          </div>
        </footer>
      </section>
    </div>
  );
};
