import type { CommandTransport } from '../../../../common/services/ipc/contracts/CommandTransport';
import type { GitRemoteService } from './GitRemoteService';

export function createGitRemoteService(transport: CommandTransport): GitRemoteService {
  return {
    addGitRemote: (input) => transport.executeCommand('add_git_remote', input),
    createGitBranch: (input) => transport.executeCommand('create_git_branch', input),
    createGitTag: (input) => transport.executeCommand('create_git_tag', input),
    deleteGitBranch: (input) => transport.executeCommand('delete_git_branch', input),
    deleteGitTag: (input) => transport.executeCommand('delete_git_tag', input),
    listGitRemotesDetailed: (input) => transport.executeCommand('list_git_remotes_detailed', input),
    listGitTags: (input) => transport.executeCommand('list_git_tags', input),
    removeGitRemote: (input) => transport.executeCommand('remove_git_remote', input),
    renameGitBranch: (input) => transport.executeCommand('rename_git_branch', input),
    setGitRemoteUrl: (input) => transport.executeCommand('set_git_remote_url', input),
    testGitRemote: (input) => transport.executeCommand('test_git_remote', input),
  };
}
