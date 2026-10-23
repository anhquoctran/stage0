import type { RepoInfo } from '../../git/types/RepoInfo';
import type { NewMrDraft } from '../types/NewMrDraft';
import type { RepoLabel } from '../types/RepoLabel';

export interface NewMrMetadataContext {
  reloadPersistedReviewers: () => void;
  currentRepo: RepoInfo | null;
  refreshRepoMetadata: (repoId: string) => Promise<void>;
  draftMr: NewMrDraft | null;
  updateDraftMr: (updates: Partial<NewMrDraft>) => void;
  repoLabels: RepoLabel[];
  createRepoLabel: (name: string, color: string, description?: string) => Promise<RepoLabel | void>;
}
