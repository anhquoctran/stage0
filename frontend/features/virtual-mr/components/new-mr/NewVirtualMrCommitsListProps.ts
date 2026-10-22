import type { NewMrDraft } from '../../types/NewMrDraft';

export interface NewVirtualMrCommitsListProps {
  draftMr: NewMrDraft;
  changeDraftBranches: (base: string, compare: string) => Promise<void>;
}
