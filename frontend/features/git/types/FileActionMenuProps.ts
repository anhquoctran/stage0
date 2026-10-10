import { type ChangedFile } from './ChangedFile';

export interface FileActionMenuProps {
  file: ChangedFile | null;
  className?: string;
}
