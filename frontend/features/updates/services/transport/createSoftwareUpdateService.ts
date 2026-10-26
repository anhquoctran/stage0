import type { CommandTransport } from '../../../../common/services/ipc/contracts/CommandTransport';
import type { SoftwareUpdateService } from './SoftwareUpdateService';

export function createSoftwareUpdateService(transport: CommandTransport): SoftwareUpdateService {
  return {
    getStatus: () => transport.executeCommand('get_software_update_status'),
    check: () => transport.executeCommand('check_software_update'),
    download: () => transport.executeCommand('download_software_update'),
    install: (input) => transport.executeCommand('install_software_update', input),
  };
}
