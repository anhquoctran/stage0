import React from 'react';
import type { CustomSelectOption } from '../../../../common/types/CustomSelectOption';
import type { AcpReviewerConfigState } from '../../../ai/types/AcpReviewerConfigState';
import type { AcpAgentConfig } from '../../../ai/types/AcpAgentConfig';
import type { AcpReviewConfigOverrides } from '../../../ai/types/AcpReviewConfigOverrides';
import type { BotCategory } from '../../../virtual-mr/types/BotCategory';

export interface RepositoryCustomBotFormProps {
  canSubmit: boolean;
  acpConfig: AcpReviewerConfigState;
  handleSaveRepoCustomBot: (e: React.FormEvent) => void;
  setIsAddingRepoBot: React.Dispatch<React.SetStateAction<boolean>>;
  repoBotEmoji: string;
  setRepoBotEmoji: React.Dispatch<React.SetStateAction<string>>;
  repoBotName: string;
  setRepoBotName: React.Dispatch<React.SetStateAction<string>>;
  repoBotTagline: string;
  setRepoBotTagline: React.Dispatch<React.SetStateAction<string>>;
  repoBotCategory: BotCategory;
  repoBotCategoryOptions: CustomSelectOption<BotCategory>[];
  setRepoBotCategory: React.Dispatch<React.SetStateAction<BotCategory>>;
  repoBotExecutionMode: 'provider' | 'acp';
  setRepoBotExecutionMode: React.Dispatch<React.SetStateAction<'provider' | 'acp'>>;
  repoBotAcpAgentId: string;
  setRepoBotAcpAgentId: React.Dispatch<React.SetStateAction<string>>;
  externalAgents: AcpAgentConfig[];
  setRepoBotAcpConfigOptions: React.Dispatch<React.SetStateAction<AcpReviewConfigOverrides>>;
  repoBotAcpConfigOptions: AcpReviewConfigOverrides;
  repoBotAllowAcpSourceTransfer: boolean;
  setRepoBotAllowAcpSourceTransfer: React.Dispatch<React.SetStateAction<boolean>>;
  repoBotInstructions: string;
  setRepoBotInstructions: React.Dispatch<React.SetStateAction<string>>;
}
