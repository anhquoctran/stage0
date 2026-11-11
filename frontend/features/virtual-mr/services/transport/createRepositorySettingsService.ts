import type { CommandTransport } from '../../../../common/services/ipc/contracts/CommandTransport';
import type { RepositorySettingsService } from './RepositorySettingsService';

export function createRepositorySettingsService(transport: CommandTransport): RepositorySettingsService {
  return {
    saveDocument: (input) => transport.executeCommand('save_repository_settings_document', input),
    getDocument: (input) => transport.executeCommand('get_repository_settings_document', input),
    commitDocument: (input) => transport.executeCommand('commit_repository_settings', input),
    createRepoLabel: (input) => transport.executeCommand('create_repo_label', input),
    deleteRepoLabel: (input) => transport.executeCommand('delete_repo_label', input),
    getRepoSettings: (input) => transport.executeCommand('get_repo_settings', input),
    listRepoLabels: (input) => transport.executeCommand('list_repo_labels', input),
    saveRepoSettings: (input) => transport.executeCommand('save_repo_settings', input),
    updateRepoLabel: (input) => transport.executeCommand('update_repo_label', input),
  };
}
