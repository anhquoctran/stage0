import React from 'react';
import { type ChangedFile } from '../../types/ChangedFile';

export interface FileListFilterBarProps {
  files: ChangedFile[];
  setFileListLayout: (layout: 'flat' | 'tree') => void;
  fileListLayout: 'flat' | 'tree';
  binaryCount: number;
  totalAdditions: number;
  totalDeletions: number;
  searchTerm: string;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  conflictedCount: number;
  setFilterConflictedOnly: React.Dispatch<React.SetStateAction<boolean>>;
  filterConflictedOnly: boolean;
}
