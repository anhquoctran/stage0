import { type ChangedFile } from './ChangedFile';

export interface FileContextMenuProps {
  x: number;
  y: number;
  file: ChangedFile;
  onClose: () => void;
}
