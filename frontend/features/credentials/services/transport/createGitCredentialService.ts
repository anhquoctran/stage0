import type { CommandTransport } from '../../../../common/services/ipc/contracts/CommandTransport';
import type { GitCredentialService } from './GitCredentialService';

export function createGitCredentialService(transport: CommandTransport): GitCredentialService {
  return {
    deleteGitCredential: (input) => transport.executeCommand('delete_git_credential', input),
    getKeyringInfo: () => transport.executeCommand('get_keyring_info'),
    listGitCredentials: () => transport.executeCommand('list_git_credentials'),
    saveGitCredential: (input) => transport.executeCommand('save_git_credential', input),
    verifyGitCredential: (input) => transport.executeCommand('verify_git_credential', input),
  };
}
