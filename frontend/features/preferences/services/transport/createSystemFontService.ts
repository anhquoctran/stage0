import type { CommandTransport } from '../../../../common/services/ipc/contracts/CommandTransport';
import type { SystemFontService } from './SystemFontService';

export function createSystemFontService(transport: CommandTransport): SystemFontService {
  return {
    listSystemFontFamilies: () => transport.executeCommand('list_system_font_families'),
  };
}
