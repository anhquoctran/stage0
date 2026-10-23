import React from 'react';
import { type ChangedFile } from '../../types/ChangedFile';

export interface FolderFileListProps {
  folderTree: Record<string, ChangedFile[]>;
  collapsedFolders: Record<string, boolean>;
  toggleFolder: (folderPath: string) => void;
  selectedFile: ChangedFile | null;
  onSelectFile: (file: ChangedFile) => void;
  handleContextMenu: (e: React.MouseEvent, file: ChangedFile) => void;
  getStatusBadge: (status: string, isConflicted: boolean) => React.JSX.Element;
}
