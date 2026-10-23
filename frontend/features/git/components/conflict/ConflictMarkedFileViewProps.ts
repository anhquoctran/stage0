import type { ChangedFile } from '../../types/ChangedFile';
import type { ConflictFilePreview } from '../../types/ConflictFilePreview';
export interface ConflictMarkedFileViewProps {
  selectedFile: ChangedFile;
  handleCopy: (text: string, key: string) => void;
  activeConflictPreview: ConflictFilePreview | null;
  copiedKey: string | null;
  fontFamily: string;
  fontSize: number;
  lineSpacing: number;
  enableLigatures: boolean;
}
