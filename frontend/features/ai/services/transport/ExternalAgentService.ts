import type { AcpAgentConfig } from '../../types/AcpAgentConfig';
import type { AcpAgentConnectionInfo } from '../../types/AcpAgentConnectionInfo';
import type { AcpRegistryResponse } from '../../types/AcpRegistryResponse';
import type { AcpSessionConfigOption } from '../../types/AcpSessionConfigOption';

/** Feature-owned backend contract. Inputs retain the existing wire field names. */
export interface ExternalAgentService {
  acpAgentAuthenticate(input: {
    config: AcpAgentConfig;
    methodId: string;
  }): Promise<{
    authStatus: AcpAgentConnectionInfo["authStatus"];
  }>;
  acpAgentConnectionInfo(input: {
    config: AcpAgentConfig;
  }): Promise<AcpAgentConnectionInfo>;
  acpAgentPrompt(input: {
    config: AcpAgentConfig;
    prompt: string;
    cwd: string | null;
  }): Promise<string>;
  acpAgentReviewConfigOptions(input: {
    config: AcpAgentConfig;
  } | {
    config: AcpAgentConfig;
    configOverrides: {
      [k: string]: string;
    };
  } | {
    config: AcpAgentConfig | undefined;
    configOverrides: {
      [k: string]: string | boolean;
    };
  }): Promise<AcpSessionConfigOption[]>;
  acpFetchRegistry(): Promise<AcpRegistryResponse>;
  acpFetchRegistryIcon(input: {
    iconUrl: string;
  }): Promise<string>;
  acpPrepareRegistryAgent(input: {
    agentId: string;
  }): Promise<AcpAgentConfig>;
}
