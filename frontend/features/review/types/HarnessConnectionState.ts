import type { McpDiscoveryState } from './McpDiscoveryState';
import type { CliHarnessReadiness } from './CliHarnessReadiness';
import type { McpServerConfig } from '../../ai/types/McpServerConfig';

export interface HarnessConnectionState {
  mcp: Record<string, McpDiscoveryState>;
  cli: CliHarnessReadiness | null;
  cliError: string | null;
  isInspectingCli: boolean;
  discover: (server: McpServerConfig, allowNetwork: boolean) => Promise<void>;
  inspectCli: (cliType: string) => Promise<void>;
}
