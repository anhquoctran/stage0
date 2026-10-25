import type { AcpReviewerConfigState } from './AcpReviewerConfigState';
import type { AcpAgentConfig } from './AcpAgentConfig';
import type { AcpReviewConfigOverrides } from './AcpReviewConfigOverrides';

export interface AcpReviewerConfigOptionsProps {
  agent?: AcpAgentConfig;
  value?: AcpReviewConfigOverrides;
  state: AcpReviewerConfigState;
}
