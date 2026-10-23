import type { RepoInfo } from '../../git/types/RepoInfo';
export interface MrMetadataDropdownsContext {
  reloadPersistedReviewers: () => void;
  currentRepo: RepoInfo | null;
  refreshRepoMetadata: (repoId: string) => Promise<void>;
}
