import React from 'react';
import type { CustomSelectOption } from '../../../../common/types/CustomSelectOption';
import type { AcpReviewerConfigState } from '../../types/AcpReviewerConfigState';
import type { AcpAgentConfig } from '../../types/AcpAgentConfig';
import type { AcpReviewConfigOverrides } from '../../types/AcpReviewConfigOverrides';
import type { AiConfig } from '../../types/AiConfig';
import type { AiModelPreset } from '../../types/AiModelPreset';
import type { AiReasoningEffort } from '../../types/AiReasoningEffort';

export interface BotExecutionModelFormProps {
  execution: {
    formExecutionMode: 'provider' | 'acp';
    setFormExecutionMode: (val: 'provider' | 'acp') => void;
    setFormReasoningEffort: (val: AiReasoningEffort | undefined) => void;
    setFormFastMode: (val: boolean) => void;
    formProvider: string;
    setFormProvider: (val: string) => void;
    setFormModel: (val: string) => void;
    formModel: string;
    formReasoningEffort: AiReasoningEffort | undefined;
    formTemp: number;
    setFormTemp: (val: number) => void;
    formFastMode: boolean;
  };
  catalog: {
    modelOptions: CustomSelectOption<string>[];
    globalAiConfig: AiConfig;
    effectiveProvider: string;
    executionBaseUrl: string;
    dynamicModels: Record<string, AiModelPreset[]>;
    fetchDynamicModels: (config: AiConfig) => Promise<{
      success: boolean;
      count: number;
      error?: string;
      models?: AiModelPreset[];
    }>;
    isFetchingDynamicModels: boolean;
    dynamicModelError: string | null;
    inheritsGlobalModel: boolean;
    executionModel: AiModelPreset | undefined;
  };
  acp: {
    acpConfig: AcpReviewerConfigState;
    externalAgents: AcpAgentConfig[];
    formAcpAgentId: string;
    setFormAcpAgentId: (val: string) => void;
    setFormAcpConfigOptions: React.Dispatch<React.SetStateAction<AcpReviewConfigOverrides>>;
    formAcpConfigOptions: AcpReviewConfigOverrides;
    formAllowAcpSourceTransfer: boolean;
    setFormAllowAcpSourceTransfer: (val: boolean) => void;
  };
}
