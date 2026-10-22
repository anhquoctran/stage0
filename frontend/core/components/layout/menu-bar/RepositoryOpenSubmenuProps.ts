import type { GitState } from '../../../../features/git/types/GitState';
import type { RepoInfo } from '../../../../features/git/types/RepoInfo';

export interface RepositoryOpenSubmenuProps {
  setActiveSubmenu: (submenu: 'sync' | 'merge' | 'rebase' | 'open' | null) => void;
  currentRepo: RepoInfo;
  activeSubmenu: 'sync' | 'merge' | 'rebase' | 'open' | null;
  onClose: () => void;
  showToast: (msg: string, level?: GitState['toastLevel']) => void;
  shortcut: (value: string) => string;
  fileManagerName: string;
}
