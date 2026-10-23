import React from 'react';
import type { AcpAgentConfig } from '../../ai/types/AcpAgentConfig';
import type { AiConfig } from '../../ai/types/AiConfig';
import type { BotReviewer } from '../../virtual-mr/types/BotReviewer';
import type { VirtualMrSession } from '../../virtual-mr/types/VirtualMrSession';
import type { ReviewBotConfig } from '../types/ReviewBotConfig';

export interface ReviewConfigurationSectionProps {
  session: VirtualMrSession | null;
  effectiveReviewerId: string;
  setSelectedReviewerId: React.Dispatch<React.SetStateAction<string>>;
  GLOBAL_REVIEWER_ID: '__stage0_global_ai_config__';
  config: AiConfig;
  reviewerProfiles: BotReviewer[];
  externalAgents: AcpAgentConfig[];
  selectedReviewer: BotReviewer | undefined;
  reviewConfig: ReviewBotConfig;
  acpConfigSummary: string;
  compatible: boolean;
  close: () => void;
  allowRemote: boolean;
  setAllowRemote: React.Dispatch<React.SetStateAction<boolean>>;
  isStarting: boolean;
  hasRunning: boolean;
  start: (
    config: ReviewBotConfig,
    allowRemote: boolean,
    reviewer?: { id: string; name: string }
  ) => Promise<void>;
  running: boolean;
  cancel: () => Promise<void>;
}
