import React from 'react';
import type { CustomSelectOption } from '../../../../common/types/CustomSelectOption';
import type { AcpAgentConfig } from '../../types/AcpAgentConfig';
import type { AcpReviewConfigOverrides } from '../../types/AcpReviewConfigOverrides';
import type { AiConfig } from '../../types/AiConfig';
import type { AiModelPreset } from '../../types/AiModelPreset';
import type { AiProviderPreset } from '../../types/AiProviderPreset';
import type { AiReasoningEffort } from '../../types/AiReasoningEffort';

export interface BotExecutionModelFormProps {
  execution: {
    formExecutionMode: 'provider' | 'acp';
    setFormExecutionMode: (val: 'provider' | 'acp') => void;
    setFormReasoningEffort: (val: AiReasoningEffort | undefined) => void;
    setFormFastMode: (val: boolean) => void;
    formProvider: string;
    setFormProvider: (val: string) => void;
    setIsCustomModel: (val: boolean) => void;
    setFormModel: (val: string) => void;
    isCustomModel: boolean;
    formModel: string;
    formReasoningEffort: AiReasoningEffort | undefined;
    formTemp: number;
    setFormTemp: (val: number) => void;
    formFastMode: boolean;
  };
  catalog: {
    modelOptions: CustomSelectOption<string>[];
    availableModels: AiModelPreset[];
    globalAiConfig: AiConfig;
    providerPreset: AiProviderPreset | undefined;
    effectiveProvider: string;
    executionBaseUrl: string;
    dynamicModels: Record<string, AiModelPreset[]>;
    inheritsGlobalModel: boolean;
    executionModel: AiModelPreset | undefined;
  };
  acp: {
    externalAgents: AcpAgentConfig[];
    formAcpAgentId: string;
    setFormAcpAgentId: (val: string) => void;
    setFormAcpConfigOptions: React.Dispatch<React.SetStateAction<AcpReviewConfigOverrides>>;
    formAcpConfigOptions: AcpReviewConfigOverrides;
    formAllowAcpSourceTransfer: boolean;
    setFormAllowAcpSourceTransfer: (val: boolean) => void;
  };
}
