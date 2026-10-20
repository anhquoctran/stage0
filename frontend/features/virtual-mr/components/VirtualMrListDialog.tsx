import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2 } from '../../../common/components/icons/CheckCircle2';
import { GitBranch } from '../../../common/components/icons/GitBranch';
import { GitPullRequest } from '../../../common/components/icons/GitPullRequest';
import { Loader2 } from '../../../common/components/icons/Loader2';
import { MessageSquare } from '../../../common/components/icons/MessageSquare';
import { Plus } from '../../../common/components/icons/Plus';
import { Search } from '../../../common/components/icons/Search';
import { Tag } from '../../../common/components/icons/Tag';
import { User } from '../../../common/components/icons/User';
import { X } from '../../../common/components/icons/X';
import { formatDateTime, formatRecentTime } from '../../../common/utils/dateTime';
import { useGitStore } from '../../git/store/useGitStore';
import { useVirtualMrStore } from '../store/useVirtualMrStore';
import type { VirtualMrSession } from '../types/VirtualMrSession';
import { getVirtualMrSearchSuggestions, matchesVirtualMrSearch, type VirtualMrSearchSuggestion } from '../utils/virtualMrSearch';

type MrFilter = 'open' | 'closed' | 'all';
type MrSort = 'updated' | 'newest' | 'oldest' | 'title';

const isClosed = (session: VirtualMrSession) => session.status === 'closed';

const SearchSuggestionIcon: React.FC<{ field: VirtualMrSearchSuggestion['field'] }> = ({ field }) => {
  if (field === 'author' || field === 'assignee') return <User className="h-3.5 w-3.5" />;
  if (field === 'reviewer' || field === 'approved-by') return <GitPullRequest className="h-3.5 w-3.5" />;
  if (field === 'label') return <Tag className="h-3.5 w-3.5" />;
  if (field === 'base' || field === 'head') return <GitBranch className="h-3.5 w-3.5" />;
  if (field === 'is') return <CheckCircle2 className="h-3.5 w-3.5" />;
  if (field === 'has' || field === 'no') return <MessageSquare className="h-3.5 w-3.5" />;
  return <Search className="h-3.5 w-3.5" />;
};

interface VirtualMrListDialogProps {
  inline?: boolean;
}

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
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchCaret, setSearchCaret] = useState(0);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isMrListOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMrListOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMrListOpen, setIsMrListOpen]);

  const counts = useMemo(() => ({
    open: sessions.filter((session) => !isClosed(session)).length,
    closed: sessions.filter(isClosed).length,
    all: sessions.length,
  }), [sessions]);

  const visibleSessions = useMemo(() => {
    const filtered = sessions.filter((session) => {
      if (activeFilter === 'open' && isClosed(session)) return false;
      if (activeFilter === 'closed' && !isClosed(session)) return false;
      return matchesVirtualMrSearch(session, searchTerm);
    });

    return filtered.sort((left, right) => {
      if (sortBy === 'title') return left.title.localeCompare(right.title);
      const leftCreated = Date.parse(left.createdAt) || 0;
      const rightCreated = Date.parse(right.createdAt) || 0;
      const leftUpdated = Date.parse(left.updatedAt) || leftCreated;
      const rightUpdated = Date.parse(right.updatedAt) || rightCreated;
      if (sortBy === 'newest') return rightCreated - leftCreated;
      if (sortBy === 'oldest') return leftCreated - rightCreated;
      return rightUpdated - leftUpdated;
    });
  }, [activeFilter, searchTerm, sessions, sortBy]);

  const searchSuggestions = useMemo(
    () => isSearchFocused
      ? getVirtualMrSearchSuggestions(searchTerm, searchCaret, sessions)
      : [],
    [isSearchFocused, searchCaret, searchTerm, sessions],
  );

  useEffect(() => {
    setActiveSuggestionIndex(0);
  }, [isSearchFocused, searchCaret, searchTerm]);

  if ((!inline && !isMrListOpen) || !currentRepo) return null;

  const handleSelect = async (sessionId: string) => {
    const session = sessions.find((item) => item.id === sessionId);
    if (!session) return;
    switchSession(session.id);
    setIsMrListOpen(false);
    await setBranchComparison(session.baseBranch, session.compareBranch);
    showToast(`Opened Virtual MR: ${session.title}`);
  };

  const filters: { id: MrFilter; label: string }[] = [
    { id: 'open', label: 'Open' },
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
              className="flex items-center gap-1.5 border border-surface1 bg-surface0 px-2.5 py-1.5 text-xs text-text hover:bg-surface1"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New MR</span>
            </button>
            {!inline && (
              <button
                type="button"
                onClick={() => setIsMrListOpen(false)}
                className="shrink-0 p-1 text-subtext0 hover:bg-surface0 hover:text-text"
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
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors ${
                  activeFilter === filter.id
                    ? 'bg-surface2 text-text'
                    : 'text-subtext1 hover:bg-surface0 hover:text-text'
                }`}
              >
                <span>{filter.label}</span>
                <span className="font-mono text-[10px] text-subtext0">{counts[filter.id]}</span>
              </button>
            ))}
          </div>

          <div className="relative min-w-[220px] flex-1">
            <label className="flex h-8 items-center gap-2 border border-surface1 bg-crust px-2.5 text-subtext0 focus-within:border-brand">
              <Search className="h-3.5 w-3.5 shrink-0" />
              <input
                ref={searchInputRef}
                type="search"
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setSearchCaret(event.target.selectionStart ?? event.target.value.length);
                }}
                onFocus={(event) => {
                  setIsSearchFocused(true);
                  setSearchCaret(event.currentTarget.selectionStart ?? searchTerm.length);
                }}
                onBlur={() => setIsSearchFocused(false)}
                onClick={(event) => setSearchCaret(event.currentTarget.selectionStart ?? searchTerm.length)}
                onKeyUp={(event) => setSearchCaret(event.currentTarget.selectionStart ?? searchTerm.length)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search MRs or type to filter…"
                className="mr-list-search-input min-w-0 flex-1 bg-transparent text-xs text-text placeholder:text-subtext0 focus:outline-none"
                aria-label="Search merge requests"
                aria-autocomplete="list"
                aria-controls={`virtual-mr-${inline ? 'inline' : 'dialog'}-search-suggestions`}
                aria-expanded={searchSuggestions.length > 0}
                aria-activedescendant={searchSuggestions.length > 0
                  ? `virtual-mr-${inline ? 'inline' : 'dialog'}-search-suggestion-${activeSuggestionIndex}`
                  : undefined}
              />
            </label>
            {searchSuggestions.length > 0 && (
              <div
                id={`virtual-mr-${inline ? 'inline' : 'dialog'}-search-suggestions`}
                className="absolute left-0 top-full z-[120] mt-1 max-h-80 w-[min(26rem,calc(100vw-2rem))] overflow-y-auto border border-surface1 bg-surface0 py-1 text-left shadow-xl"
                role="listbox"
                aria-label="Search syntax suggestions"
              >
                {searchSuggestions.map((suggestion, index) => (
                  <button
                    key={`${suggestion.field}:${suggestion.value}`}
                    id={`virtual-mr-${inline ? 'inline' : 'dialog'}-search-suggestion-${index}`}
                    type="button"
                    role="option"
                    aria-selected={activeSuggestionIndex === index}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActiveSuggestionIndex(index)}
                    onClick={() => applySearchSuggestion(suggestion)}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs ${
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

          <label className="flex h-8 items-center gap-2 text-xs text-subtext0">
            <span>Sort:</span>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as MrSort)}
              className="h-full border border-surface1 bg-crust px-2 text-xs text-text focus:outline-none focus:border-brand"
              aria-label="Sort merge requests"
            >
              <option value="updated">Recently updated</option>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="title">Title A–Z</option>
            </select>
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {isLoadingSessions ? (
            <div className="flex items-center justify-center gap-2 py-14 text-xs text-subtext0">
              <Loader2 className="h-4 w-4 animate-spin text-brand" />
              <span>Loading saved merge requests…</span>
            </div>
          ) : visibleSessions.length > 0 ? (
            <div className="divide-y divide-surface0">
              {visibleSessions.map((session) => {
                const closed = isClosed(session);
                const statusLabel = closed ? 'Closed' : session.status === 'approved' ? 'Approved' : 'Open';
                const updatedLabel = formatRecentTime(session.updatedAt) || 'Unknown';

                return (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => handleSelect(session.id)}
                    className="group flex w-full items-start justify-between gap-4 px-5 py-3.5 text-left hover:bg-surface0/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="truncate text-sm font-semibold text-text group-hover:text-brand" title={session.title}>
                          {session.title}
                        </span>
                        <span className={`inline-flex shrink-0 items-center gap-1 border px-1.5 py-0.5 text-[10px] ${
                          closed
                            ? 'border-surface1 bg-surface0 text-subtext1'
                            : session.status === 'approved'
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                            : 'border-brand/30 bg-brand/10 text-brand'
                        }`}>
                          {closed ? <CheckCircle2 className="h-3 w-3" /> : null}
                          {statusLabel}
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] text-subtext1">
                        <span className="max-w-full truncate" title={`${session.compareBranch} → ${session.baseBranch}`}>
                          {session.compareBranch} <span className="text-subtext0">→</span> {session.baseBranch}
                        </span>
                        {session.labels.map((label) => (
                          <span key={label.id} className="border border-surface1 px-1.5 py-0.5 text-[10px] text-subtext0">
                            {label.name}
                          </span>
                        ))}
                      </div>
                      {session.description.trim() && (
                        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-subtext0">
                          {session.description.replace(/[#*`>\[\]()]/g, '').replace(/\s+/g, ' ').trim()}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-2 text-[11px] text-subtext0">
                      <time dateTime={session.updatedAt} title={formatDateTime(session.updatedAt)}>
                        {updatedLabel}
                      </time>
                      <span className="inline-flex items-center gap-1" title={`${session.discussions.length} discussions`}>
                        <MessageSquare className="h-3 w-3" />
                        {session.discussions.length}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center px-6 py-14 text-center">
              <GitPullRequest className="mb-3 h-7 w-7 text-subtext0" />
              <h3 className="text-sm font-semibold text-text">
                {searchTerm.trim() ? 'No matching merge requests' : activeFilter === 'closed' ? 'No closed merge requests' : activeFilter === 'open' ? 'No open merge requests' : 'No merge requests yet'}
              </h3>
              <p className="mt-1 max-w-sm text-xs leading-relaxed text-subtext0">
                {searchTerm.trim()
                  ? 'Try another title, branch, description, or label.'
                  : 'Virtual MRs are saved with this repository and will be here when you open it again.'}
              </p>
              {!searchTerm.trim() && activeFilter !== 'closed' && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMrListOpen(false);
                    void openNewMrDraft();
                  }}
                  className="mt-4 border border-brand bg-brand px-3 py-1.5 text-xs font-semibold text-on-accent hover:bg-brand/90"
                >
                  Create Virtual MR
                </button>
              )}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-surface0 px-5 py-2 text-[10px] text-subtext0">
          <span>Showing {visibleSessions.length} of {counts[activeFilter]}</span>
          <span>Select an MR to reopen its review workspace</span>
        </footer>
      </section>
    </div>
  );
};
