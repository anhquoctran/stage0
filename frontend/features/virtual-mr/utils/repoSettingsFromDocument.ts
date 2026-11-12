import type { RepositorySettingsDocument } from '../types/RepositorySettingsDocument';
import type { RepoSettings } from '../types/RepoSettings';

export function repoSettingsFromDocument(repoId: string, doc: RepositorySettingsDocument): RepoSettings {
  return {
    repoId, revision: doc.revision, validationError: doc.validationError,
    defaultBaseBranch: doc.settings.defaultBaseBranch,
    inheritGlobalAgents: doc.settings.inheritGlobalAgents,
    customAgentRules: doc.settings.customAgentRules,
    activeAgentIds: doc.settings.activeAgentIds ?? [],
    customReviewers: doc.settings.customReviewers,
  };
}
