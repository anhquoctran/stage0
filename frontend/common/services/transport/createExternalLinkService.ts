import type { CommandTransport } from '../ipc/contracts/CommandTransport';
import type { ExternalLinkService } from './ExternalLinkService';

export function createExternalLinkService(transport: CommandTransport): ExternalLinkService {
  return {
    openExternalUrl: (input) => transport.executeCommand('open_external_url', input),
  };
}
