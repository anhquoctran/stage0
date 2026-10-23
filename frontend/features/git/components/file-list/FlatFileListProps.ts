import React from 'react';
import { type ChangedFile } from '../../types/ChangedFile';

export interface FlatFileListProps {
  filteredFiles: ChangedFile[];
  selectedFile: ChangedFile | null;
  splitPath: (fullPath: string) => { dir: string; file: string };
  onSelectFile: (file: ChangedFile) => void;
  handleContextMenu: (e: React.MouseEvent, file: ChangedFile) => void;
  getStatusBadge: (status: string, isConflicted: boolean) => React.JSX.Element;
}
