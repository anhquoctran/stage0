import type { ChangedFile } from '../../types/ChangedFile';
import type { ConflictFilePreview } from '../../types/ConflictFilePreview';
import type { ConflictRegion } from '../../types/ConflictRegion';
import type { RepoInfo } from '../../types/RepoInfo';

export interface ConflictResolutionBarProps {
  regions: ConflictRegion[];
  activeConflictPreview: ConflictFilePreview | null;
  selectedFile: ChangedFile;
  baseBranch: string;
  compareBranch: string;
  currentRepo: RepoInfo | null;
  handleOpenInVsCode: () => Promise<void>;
  handleRevealInOs: () => Promise<void>;
  fileManagerName: string;
  fetchConflictPreview: (filePath?: string) => Promise<void>;
  refreshDiff: () => Promise<void>;
  onSwitchToDiff: (() => void) | undefined;
}
