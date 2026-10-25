import type { CommandTransport } from '../../../../common/services/ipc/contracts/CommandTransport';
import type { AboutService } from './AboutService';

export function createAboutService(transport: CommandTransport): AboutService {
  return {
    getAppInfo: () => transport.executeCommand('get_app_info'),
    getReleaseNotes: () => transport.executeCommand('get_release_notes'),
  };
}
