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

export interface AcpRegistryAgent {
  id: string;
  name: string;
  version: string;
  description: string;
  icon?: string;
  website?: string;
  repository?: string;
  license?: string;
  licenseUrl?: string;
  distribution: Record<string, unknown> & {
    binary?: Record<string, unknown>;
  };
}
