import type { DiscoveredMcpTool } from './DiscoveredMcpTool';

export interface McpDiscoveryReport {
  connectionId: string;
  endpointFingerprint: string;
  catalogFingerprint: string;
  protocolVersion: string;
  serverName: string;
  serverVersion: string;
  tools: DiscoveredMcpTool[];
  discoveredAt: string;
  attachedToHarness: false;
}
