import type { AcpAgentConfig } from '../../ai/types/AcpAgentConfig';
import type { AiProviderId } from '../../ai/types/AiProviderId';

export type OnboardingReviewerConnection =
  | { value: string; id: AiProviderId; kind: 'provider'; label: string; model: string }
  | { value: string; id: string; kind: 'acp'; label: string; agent: AcpAgentConfig };
