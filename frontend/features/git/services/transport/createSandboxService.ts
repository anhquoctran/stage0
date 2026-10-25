import type { CommandTransport } from '../../../../common/services/ipc/contracts/CommandTransport';
import type { SandboxService } from './SandboxService';

export function createSandboxService(transport: CommandTransport): SandboxService {
  return {
    createSandboxInstance: (input) => transport.executeCommand('create_sandbox_instance', input),
    destroySandboxInstance: (input) => transport.executeCommand('destroy_sandbox_instance', input),
    executeSandboxCommand: (input) => transport.executeCommand('execute_sandbox_command', input),
    getActiveSandbox: () => transport.executeCommand('get_active_sandbox'),
    getAvailableSandboxes: () => transport.executeCommand('get_available_sandboxes'),
    setActiveSandbox: (input) => transport.executeCommand('set_active_sandbox', input),
  };
}
