import { useEffect,useMemo,useState } from 'react';
import type { MrFilter } from '../types/MrFilter';
import type { VirtualMrSession } from '../types/VirtualMrSession';
import { matchesVirtualMrSearch } from '../utils/virtualMrSearch';
import type { VirtualMrPaginationContext } from './VirtualMrPaginationContext';

const hasStatus = (session: VirtualMrSession, status: Exclude<MrFilter, 'all'>) =>
  session.status === status;

export function useVirtualMrPagination({
  sessions,
  activeFilter,
  searchTerm,
  sortBy,
  sortDirection,
  currentRepo,
  listRef,
}: VirtualMrPaginationContext) {
  const [currentPage, setCurrentPage] = useState(1);

  const [pageSize, setPageSize] = useState('20');

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

  return {
    counts,
    visibleSessions,
    pagedSessions,
    pageOffset,
    pageSize,
    setPageSize,
    pageCount,
    setCurrentPage,
    page,
  };
}
