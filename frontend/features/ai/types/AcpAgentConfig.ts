export interface AcpAgentConfig {
  id: string;
  name: string;
  version?: string;
  description?: string;
  source: 'registry' | 'custom';
  command: string;
  launchMode?: 'binary';
  args: string[];
}

export type { AcpRegistryAgent } from './AcpRegistryAgent';
