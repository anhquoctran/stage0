import React from 'react';
import type { RepoInfo } from '../../git/types/RepoInfo';
import type { MrFilter } from '../types/MrFilter';
import type { MrSort } from '../types/MrSort';
import type { SortDirection } from '../types/SortDirection';
import type { VirtualMrSession } from '../types/VirtualMrSession';

export interface VirtualMrPaginationContext {
  sessions: VirtualMrSession[];
  activeFilter: MrFilter;
  searchTerm: string;
  sortBy: MrSort;
  sortDirection: SortDirection;
  currentRepo: RepoInfo | null;
  listRef: React.RefObject<HTMLDivElement | null>;
}
