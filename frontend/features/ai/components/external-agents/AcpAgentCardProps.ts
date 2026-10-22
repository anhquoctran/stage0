import React from 'react';
import type { AcpAgentConfig, AcpRegistryAgent } from '../../types/AcpAgentConfig';

export interface AcpAgentCardProps {
  isCustom: boolean;
  item: AcpRegistryAgent | AcpAgentConfig;
  installed: AcpAgentConfig | undefined;
  openDetails: (agent: AcpAgentConfig, entry?: AcpRegistryAgent) => void;
  entry: AcpRegistryAgent | undefined;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  installable: boolean;
  unavailableReason: string | undefined;
  name: string;
  version: string | undefined;
  description: string;
  busyId: string | null;
  install: (entry: AcpRegistryAgent) => Promise<void>;
  registryDistribution: (entry: AcpRegistryAgent) => string;
}
