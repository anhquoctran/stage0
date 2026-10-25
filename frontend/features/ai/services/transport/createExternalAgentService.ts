import type { CommandTransport } from '../../../../common/services/ipc/contracts/CommandTransport';
import type { ExternalAgentService } from './ExternalAgentService';

export function createExternalAgentService(transport: CommandTransport): ExternalAgentService {
  return {
    acpAgentAuthenticate: (input) => transport.executeCommand('acp_agent_authenticate', input),
    acpAgentConnectionInfo: (input) => transport.executeCommand('acp_agent_connection_info', input),
    acpAgentPrompt: (input) => transport.executeCommand('acp_agent_prompt', input),
    acpAgentReviewConfigOptions: (input) => transport.executeCommand('acp_agent_review_config_options', input),
    acpFetchRegistry: () => transport.executeCommand('acp_fetch_registry'),
    acpFetchRegistryIcon: (input) => transport.executeCommand('acp_fetch_registry_icon', input),
    acpPrepareRegistryAgent: (input) => transport.executeCommand('acp_prepare_registry_agent', input),
  };
}
