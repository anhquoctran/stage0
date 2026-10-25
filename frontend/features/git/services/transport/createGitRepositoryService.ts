import type { CommandTransport } from '../../../../common/services/ipc/contracts/CommandTransport';
import type { GitRepositoryService } from './GitRepositoryService';

export function createGitRepositoryService(transport: CommandTransport): GitRepositoryService {
  return {
    clearRecentRepos: () => transport.executeCommand('clear_recent_repos'),
    cloneRepository: ({ onProgress, ...input }) => transport.executeWithProgress('clone_repository', input, onProgress),
    closeRepositoryWindow: () => transport.executeCommand('close_repository_window'),
    deleteRecentRepo: (input) => transport.executeCommand('delete_recent_repo', input),
    getBranches: (input) => transport.executeCommand('get_branches', input),
    getCloneRemoteRefs: (input) => transport.executeCommand('get_clone_remote_refs', input),
    getGitRemoteUrl: (input) => transport.executeCommand('get_git_remote_url', input),
    getRecentRepos: () => transport.executeCommand('get_recent_repos'),
    listGitRemotes: (input) => transport.executeCommand('list_git_remotes', input),
    openRepoByPath: (input) => transport.executeCommand('open_repo_by_path', input),
    openRepoDialog: (input) => transport.executeCommand('open_repo_dialog', input),
    validateRepo: (input) => transport.executeCommand('validate_repo', input),
  };
}
