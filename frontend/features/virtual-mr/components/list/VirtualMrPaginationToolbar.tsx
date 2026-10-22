import { CustomSelect } from '../../../../common/components/CustomSelect';
import { ChevronLeft } from '../../../../common/components/icons/ChevronLeft';
import { ChevronRight } from '../../../../common/components/icons/ChevronRight';
import type { VirtualMrPaginationToolbarProps } from './VirtualMrPaginationToolbarProps';

export function VirtualMrPaginationToolbar({
  isLoadingSessions,
  visibleSessions,
  pageOffset,
  pagedSessions,
  pageSize,
  setPageSize,
  PAGE_SIZE_OPTIONS,
  pageCount,
  setCurrentPage,
  page,
}: VirtualMrPaginationToolbarProps) {
  return (
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
            <span className="px-2 tabular-nums">
              Page {page} of {pageCount}
            </span>
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
  );
}
