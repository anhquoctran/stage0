import type { GitSyncOperation } from '../../../../features/git/types/GitSyncOperation';
import type { GitSyncOptions } from '../../../../features/git/types/GitSyncOptions';
export interface RepositoryRebaseSubmenuProps {
  setActiveSubmenu: (submenu: 'sync' | 'merge' | 'rebase' | 'open' | null) => void;
  activeSubmenu: 'sync' | 'merge' | 'rebase' | 'open' | null;
  isSyncing: boolean;
  runSync: (op: GitSyncOperation, options?: GitSyncOptions) => Promise<void>;
  onClose: () => void;
  shortcut: (value: string) => string;
  setIsRebaseFromOpen: (open: boolean) => void;
  isRebasing: boolean;
}
