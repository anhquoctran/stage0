import React,{ useEffect,useMemo,useRef,useState } from 'react';
import { GitPullRequest } from '../../../common/components/icons/GitPullRequest';
import { Loader2 } from '../../../common/components/icons/Loader2';
import type { CustomSelectOption } from '../../../common/types/CustomSelectOption';
import { formatRecentTime } from '../../../common/utils/dateTime';
import * as botStoreModule from '../../ai/store/useBotReviewersStore';
import { useGitStore } from '../../git/store/useGitStore';
import { useVirtualMrStore } from '../store/useVirtualMrStore';
import type { MrFilter } from '../types/MrFilter';
import type { MrSort } from '../types/MrSort';
import type { SortDirection } from '../types/SortDirection';
import type { VirtualMrListDialogProps } from '../types/VirtualMrListDialogProps';
import { buildMrSequenceMap } from '../utils/virtualMrSequence';
import { VirtualMrListHeader } from './list/VirtualMrListHeader';
import { VirtualMrListItem } from './list/VirtualMrListItem';
import { VirtualMrPaginationToolbar } from './list/VirtualMrPaginationToolbar';
import { VirtualMrSearchBox } from './list/VirtualMrSearchBox';
import { useVirtualMrListSearch } from './useVirtualMrListSearch';
import { useVirtualMrPagination } from './useVirtualMrPagination';

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
  const {
    searchTerm,
    searchScrollLeft,
    searchHighlights,
    searchInputRef,
    setSearchTerm,
    setSearchCaret,
    setSearchScrollLeft,
    setIsSearchFocused,
    handleSearchKeyDown,
    searchSuggestions,
    activeSuggestionIndex,
    applySearchSuggestion,
  } = useVirtualMrListSearch({ sessions });

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

  const {
    counts,
    visibleSessions,
    pagedSessions,
    pageOffset,
    pageSize,
    setPageSize,
    pageCount,
    setCurrentPage,
    page,
  } = useVirtualMrPagination({
    sessions,
    activeFilter,
    searchTerm,
    sortBy,
    sortDirection,
    currentRepo,
    listRef,
  });

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

  return (
    <div
      className={
        inline
          ? 'flex h-full min-h-0 w-full flex-col bg-mantle'
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
        className={`flex w-full flex-col bg-mantle text-text ${
          inline ? 'min-h-0 flex-1' : 'border border-surface1 max-w-5xl max-h-[calc(100vh-4rem)] shadow-2xl rounded-sm'
        }`}
        role={inline ? 'region' : 'dialog'}
      >
        <VirtualMrListHeader
          sessions={sessions}
          currentRepo={currentRepo}
          setIsMrListOpen={setIsMrListOpen}
          openNewMrDraft={openNewMrDraft}
          inline={inline}
        />

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface0 px-5 py-3 rounded-sm">
          <div
            className="flex items-center gap-1 border border-surface1 bg-crust p-0.5 rounded-sm"
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
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors cursor-pointer rounded-sm ${
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
                  className="mt-4 border border-brand bg-brand px-3 py-1.5 text-xs font-semibold text-on-accent hover:bg-brand/90 cursor-pointer rounded-sm"
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
