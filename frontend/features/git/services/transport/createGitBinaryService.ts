import type { CommandTransport } from '../../../../common/services/ipc/contracts/CommandTransport';
import type { GitBinaryService } from './GitBinaryService';

export function createGitBinaryService(transport: CommandTransport): GitBinaryService {
  return {
    getActiveGitBinary: () => transport.executeCommand('get_active_git_binary'),
    pickGitExecutable: () => transport.executeCommand('pick_git_executable'),
    scanGitBinaries: () => transport.executeCommand('scan_git_binaries'),
    setActiveGitBinary: (input) => transport.executeCommand('set_active_git_binary', input),
    validateCustomGitBinary: (input) => transport.executeCommand('validate_custom_git_binary', input),
  };
}
