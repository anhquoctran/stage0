import type { AcpRegistryAgent } from './AcpRegistryAgent';

export type AcpRegistryResponse = {
  agents: AcpRegistryAgent[];
  supportedBinaryTarget?: string | null;
};

