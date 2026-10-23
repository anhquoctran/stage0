import type { RepoInfo } from '../../../features/git/types/RepoInfo';
import type { MenuFlags } from './MenuFlags';
import type { MenuNode } from './MenuNode';

export interface ConfiguredMenuProps {
  node: MenuNode;
  flags: MenuFlags;
  platform: string;
  fileManager: string;
  recentRepos: RepoInfo[];
  execute: (id: string) => void;
  onClose: () => void;
  isOpen?: boolean;
  onToggle?: () => void;
  onHover?: () => void;
  onLeave?: () => void;
}
