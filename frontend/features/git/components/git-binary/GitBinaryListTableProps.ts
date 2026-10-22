import React from 'react';
import type { GitBinaryInfo } from '../../types/GitBinaryInfo';

export interface GitBinaryListTableProps {
  allBinaries: GitBinaryInfo[];
  draftBinaryId: string;
  draftBinaryPath: string;
  committedBinaryId: string;
  committedBinaryPath: string;
  onSelectBinary: (id: string, path: string) => void;
  getSourceIcon: (source: string) => React.JSX.Element;
  getSourceBadge: (source: string) => React.JSX.Element;
  handleCopyPath: (path: string, e: React.MouseEvent) => void;
  copiedPath: string | null;
}
