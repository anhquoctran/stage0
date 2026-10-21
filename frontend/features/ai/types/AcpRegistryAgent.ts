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

