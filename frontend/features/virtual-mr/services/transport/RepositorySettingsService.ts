import type { RepositorySettingsDocument } from '../../types/RepositorySettingsDocument';
import type { RepositorySettingsConfig } from '../../types/RepositorySettingsConfig';
import type { RepoSettingsRecord } from '../../types/RepoSettingsRecord';
import type { RepoLabelRecord } from '../../types/RepoLabelRecord';

export interface RepositorySettingsService {
  getDocument(input: { repoId: string }): Promise<RepositorySettingsDocument>;
  commitDocument(input: { repoId: string; expectedRevision: string; patch: Partial<RepositorySettingsConfig> }): Promise<RepositorySettingsDocument>;
  createRepoLabel(input: { label: RepoLabelRecord; expectedRevision: string }): Promise<unknown>;
  updateRepoLabel(input: { label: RepoLabelRecord; expectedRevision: string }): Promise<unknown>;
  deleteRepoLabel(input: { id: string; expectedRevision: string }): Promise<unknown>;
  getRepoSettings(input: { repoId: string }): Promise<RepoSettingsRecord | null>;
  listRepoLabels(input: { repoId: string }): Promise<RepoLabelRecord[]>;
  saveRepoSettings(input: { settings: RepoSettingsRecord; expectedRevision: string }): Promise<unknown>;
}
