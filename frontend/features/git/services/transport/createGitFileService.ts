import type { CommandTransport } from '../../../../common/services/ipc/contracts/CommandTransport';
import type { GitFileService } from './GitFileService';

export function createGitFileService(transport: CommandTransport): GitFileService {
  return {
    getFileTextDiff: (input) => transport.executeCommand('get_file_text_diff', input),
    openFileInEditor: (input) => transport.executeCommand('open_file_in_editor', input),
    openRepoIn: (input) => transport.executeCommand('open_repo_in', input),
    revealFileInOs: (input) => transport.executeCommand('reveal_file_in_os', input),
  };
}
