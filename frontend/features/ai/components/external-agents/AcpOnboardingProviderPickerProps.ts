import type { AcpAgentConfig, AcpRegistryAgent } from '../../types/AcpAgentConfig';

export interface AcpOnboardingProviderPickerProps {
  registry: AcpRegistryAgent[];
  externalAgents: AcpAgentConfig[];
  supportedBinaryTarget?: string;
  busyId: string | null;
  isLoading: boolean;
  canLaunchAgents: boolean;
  onInstall: (entry: AcpRegistryAgent) => void;
  onManage: (agent: AcpAgentConfig, entry: AcpRegistryAgent) => void;
}
