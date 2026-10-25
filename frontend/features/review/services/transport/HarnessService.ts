import type { CliHarnessReadiness } from '../../types/CliHarnessReadiness';
import type { McpDiscoveryReport } from '../../types/McpDiscoveryReport';

/** Feature-owned backend contract. Inputs retain the existing wire field names. */
export interface HarnessService {
  discoverHarnessMcp(input: {
    request: {
      connectionId: string;
      url: string;
      allowNetwork: boolean;
    };
  }): Promise<McpDiscoveryReport>;
  inspectHarnessCli(input: {
    cliType: string;
  }): Promise<CliHarnessReadiness>;
}
