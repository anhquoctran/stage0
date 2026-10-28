import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const firstItem = visibleSessions.length ? pageOffset + 1 : 0;
  const lastItem = pageOffset + pagedSessions.length;
  return (
    <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-surface0 px-5 py-2 text-[10px] text-subtext0">
      <span role="status">
        {isLoadingSessions
          ? t('virtualMr.loadingMergeRequests')
          : t('virtualMr.showingPageItems', { start: firstItem, end: lastItem, count: visibleSessions.length })}
      </span>
      <div className="flex items-center gap-3">
        <CustomSelect
          value={pageSize}
          onChange={setPageSize}
          options={PAGE_SIZE_OPTIONS}
          disabled={isLoadingSessions}
          buttonClassName="min-w-[104px]"
          menuClassName="!top-auto bottom-full !mt-0 mb-1.5"
          dropdownWidth="w-48"
          aria-label={t('virtualMr.mergeRequestsPerPage')}
        />
        {pageCount > 1 && (
          <nav className="flex items-center gap-1" aria-label={t('virtualMr.pagination')}>
            <button
              type="button"
              onClick={() => setCurrentPage(page - 1)}
              disabled={isLoadingSessions || page === 1}
              aria-label={t('virtualMr.previousPage')}
              title={t('virtualMr.previousPage')}
              className="flex h-7 w-7 items-center justify-center border border-surface1 text-text hover:bg-surface0 focus-visible:outline focus-visible:outline-1 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-35 cursor-pointer rounded-sm"
            >
              <ChevronLeft className="h-3 w-3 rtl:rotate-180" />
            </button>
            <span className="px-2 tabular-nums">
              {t('virtualMr.pageOf', { page, pageCount })}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage(page + 1)}
              disabled={isLoadingSessions || page === pageCount}
              aria-label={t('virtualMr.nextPage')}
              title={t('virtualMr.nextPage')}
              className="flex h-7 w-7 items-center justify-center border border-surface1 text-text hover:bg-surface0 focus-visible:outline focus-visible:outline-1 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-35 cursor-pointer rounded-sm"
            >
              <ChevronRight className="h-3 w-3 rtl:rotate-180" />
            </button>
          </nav>
        )}
      </div>
    </footer>
  );
}
