import type { BranchList } from '../../../git/types/BranchList';
import type { ConflictReport } from '../../../git/types/ConflictReport';
import type { NewMrDraft } from '../../types/NewMrDraft';

export interface NewVirtualMrHeaderProps {
  closeNewMrDraft: () => void;
  draftMr: NewMrDraft;
  branches: BranchList | null;
  handleBaseChange: (newBase: string) => void;
  handleSwapBranches: () => void;
  handleCompareChange: (newCompare: string) => void;
  diffError: string | null;
  isDiffLoading: boolean;
  conflictCheckError: string | null;
  noFileChanges: boolean;
  isIdentical: boolean;
  hasConflicts: boolean;
  conflictCount: number;
  conflictReport: ConflictReport | null;
}
