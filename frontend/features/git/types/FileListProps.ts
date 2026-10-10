import { type ChangedFile } from './ChangedFile';

export interface FileListProps {
  files: ChangedFile[];
  selectedFile: ChangedFile | null;
  onSelectFile: (file: ChangedFile) => void;
  isLoading?: boolean;
  width?: number;
}
