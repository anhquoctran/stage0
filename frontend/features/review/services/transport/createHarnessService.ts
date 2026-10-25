import type { CommandTransport } from '../../../../common/services/ipc/contracts/CommandTransport';
import type { HarnessService } from './HarnessService';

export function createHarnessService(transport: CommandTransport): HarnessService {
  return {
    discoverHarnessMcp: (input) => transport.executeCommand('discover_harness_mcp', input),
    inspectHarnessCli: (input) => transport.executeCommand('inspect_harness_cli', input),
  };
}
