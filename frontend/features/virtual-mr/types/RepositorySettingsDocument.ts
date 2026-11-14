import type { RepositorySettingsConfig } from './RepositorySettingsConfig';
import type { RepoLabelRecord } from './RepoLabelRecord';

export interface RepositorySettingsDocument {
  revision: string;
  publicationSequence: number;
  content: string;
  settings: RepositorySettingsConfig;
  validationError: string | null;
  labels: RepoLabelRecord[];
}
