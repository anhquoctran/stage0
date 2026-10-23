import type { ChangedFile } from '../../../features/git/types/ChangedFile';
import type { GitState } from '../../../features/git/types/GitState';
import type { GitSyncOperation } from '../../../features/git/types/GitSyncOperation';
import type { GitSyncOptions } from '../../../features/git/types/GitSyncOptions';
import type { RepoInfo } from '../../../features/git/types/RepoInfo';
import type { ViewMode } from '../../../features/git/types/ViewMode';
export interface WorkspaceShortcutsContext {
  setIsPreferencesOpen: (open: boolean) => void;
  setIsCloneModalOpen: (open: boolean) => void;
  currentRepo: RepoInfo | null;
  selectNextConflictFile: () => void;
  selectNextFile: () => void;
  selectPrevFile: () => void;
  runSync: (op: GitSyncOperation, options?: GitSyncOptions) => Promise<void>;
  setIsPullFromOpen: (open: boolean) => void;
  setIsMergeFromOpen: (open: boolean) => void;
  setIsRebaseFromOpen: (open: boolean) => void;
  setViewMode: (mode: ViewMode) => void;
  refreshDiff: () => Promise<void>;
  selectedFile: ChangedFile | null;
  showToast: (msg: string, level?: GitState['toastLevel']) => void;
  fileManagerName: string;
  remoteUrl: string | null;
  compareBranch: string;
  setTargetFileForUrl: (file: ChangedFile | null) => void;
  setIsRemoteUrlFromOpen: (open: boolean) => void;
  toggleInlineBlame: () => void;
  showInlineBlame: boolean;
}
