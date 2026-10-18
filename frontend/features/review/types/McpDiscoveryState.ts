import type { McpDiscoveryReport } from './McpDiscoveryReport';

export interface McpDiscoveryState {
  requestKey: string;
  requestId: number;
  status: 'discovering' | 'discovered' | 'failed';
  report: McpDiscoveryReport | null;
  error: string | null;
}
