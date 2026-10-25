import type { CommandTransport } from '../../../../common/services/ipc/contracts/CommandTransport';
import type { VirtualMrService } from './VirtualMrService';

export function createVirtualMrService(transport: CommandTransport): VirtualMrService {
  return {
    listVirtualMrSessions: (input) => transport.executeCommand('list_virtual_mr_sessions', input),
    saveVirtualMrSession: (input) => transport.executeCommand('save_virtual_mr_session', input),
  };
}
