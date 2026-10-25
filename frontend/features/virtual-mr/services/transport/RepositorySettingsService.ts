import type { RepoSettingsRecord } from '../../types/RepoSettingsRecord';
import type { RepoLabelRecord } from '../../types/RepoLabelRecord';

export interface RepositorySettingsService {
  createRepoLabel(input: { label: RepoLabelRecord }): Promise<unknown>;
  updateRepoLabel(input: { label: RepoLabelRecord }): Promise<unknown>;
  deleteRepoLabel(input: { id: string }): Promise<unknown>;
  getRepoSettings(input: { repoId: string }): Promise<RepoSettingsRecord | null>;
  listRepoLabels(input: { repoId: string }): Promise<RepoLabelRecord[]>;
  saveRepoSettings(input: { settings: RepoSettingsRecord }): Promise<unknown>;
}
