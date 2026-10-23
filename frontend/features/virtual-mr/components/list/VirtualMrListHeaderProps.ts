import type { RepoInfo } from '../../../git/types/RepoInfo';
import type { VirtualMrSession } from '../../types/VirtualMrSession';

export interface VirtualMrListHeaderProps {
  sessions: VirtualMrSession[];
  currentRepo: RepoInfo;
  setIsMrListOpen: (isOpen: boolean) => void;
  openNewMrDraft: (baseBranch?: string, compareBranch?: string) => Promise<void>;
  inline: boolean;
}
