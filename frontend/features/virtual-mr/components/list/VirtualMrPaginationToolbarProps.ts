import React from 'react';
import type { CustomSelectOption } from '../../../../common/types/CustomSelectOption';
import type { VirtualMrSession } from '../../types/VirtualMrSession';

export interface VirtualMrPaginationToolbarProps {
  isLoadingSessions: boolean;
  visibleSessions: VirtualMrSession[];
  pageOffset: number;
  pagedSessions: VirtualMrSession[];
  pageSize: string;
  setPageSize: React.Dispatch<React.SetStateAction<string>>;
  PAGE_SIZE_OPTIONS: CustomSelectOption<string>[];
  pageCount: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  page: number;
}
