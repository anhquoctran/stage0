import type { CommandTransport } from '../../../../common/services/ipc/contracts/CommandTransport';
import type { GitFileService } from './GitFileService';

export function createGitFileService(transport: CommandTransport): GitFileService {
  return {
    openFileInEditor: (input) => transport.executeCommand('open_file_in_editor', input),
    openRepoIn: (input) => transport.executeCommand('open_repo_in', input),
    revealFileInOs: (input) => transport.executeCommand('reveal_file_in_os', input),
  };
}
