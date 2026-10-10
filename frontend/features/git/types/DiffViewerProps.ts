import { type ChangedFile } from './ChangedFile';
import { type MrDiffPayload } from './MrDiffPayload';
import { type ViewMode } from './ViewMode';

export interface DiffViewerProps {
  selectedFile: ChangedFile | null;
  diffPayload: MrDiffPayload | null;
  viewMode: ViewMode;
  onToggleViewMode: (mode: ViewMode) => void;
  isLoading?: boolean;
  onOpenRepo?: () => void;
}
