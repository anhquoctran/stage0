import type { CommandTransport } from '../../../../common/services/ipc/contracts/CommandTransport';
import type { GitSyncService } from './GitSyncService';

export function createGitSyncService(transport: CommandTransport): GitSyncService {
  return {
    checkRebaseStatus: (input) => transport.executeCommand('check_rebase_status', input),
    runGitSync: ({ onProgress, ...input }) => transport.executeWithProgress('run_git_sync', input, onProgress),
  };
}
