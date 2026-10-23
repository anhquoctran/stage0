import React from 'react';
import type { ChangedFile } from '../../../features/git/types/ChangedFile';
import type { MrDiffPayload } from '../../../features/git/types/MrDiffPayload';

export interface MainLayoutDiffWorkspaceProps {
  diffPayload: MrDiffPayload | null;
  selectedFile: ChangedFile | null;
  selectFile: (file: ChangedFile | null) => void;
  isDiffLoading: boolean;
  sidebarWidth: number;
  isResizing: boolean;
  startResizing: (e: React.MouseEvent) => void;
  resetSidebarWidth: () => void;
  viewMode: 'split' | 'unified';
  setViewMode: (mode: 'split' | 'unified') => void;
  openRepoDialog: (newWindow?: boolean) => void;
}

