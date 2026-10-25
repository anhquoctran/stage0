import React from 'react';
import type { BotCategory } from '../../virtual-mr/types/BotCategory';
import type { AcpReviewerConfigState } from '../types/AcpReviewerConfigState';
import type { AcpAgentConfig } from '../types/AcpAgentConfig';
import type { AcpReviewConfigOverrides } from '../types/AcpReviewConfigOverrides';
import type { AiConfig } from '../types/AiConfig';
import type { AiModelPreset } from '../types/AiModelPreset';
import type { AiProviderPreset } from '../types/AiProviderPreset';
import type { AiReasoningEffort } from '../types/AiReasoningEffort';

export interface BotReviewerModalProps {
  dialog: {
    isOpen: boolean;
    canSubmit: boolean;
    editingBotId: string | null;
    formError: string | null;
    onClose: () => void;
    onSubmit: (e: React.FormEvent) => void;
  };
  identity: {
    formName: string;
    setFormName: (val: string) => void;
    formTagline: string;
    setFormTagline: (val: string) => void;
    formDesc: string;
    setFormDesc: (val: string) => void;
    formCategory: BotCategory;
    setFormCategory: (val: BotCategory) => void;
    formEmoji: string;
    setFormEmoji: (val: string) => void;
    formInstructions: string;
    setFormInstructions: (val: string) => void;
  };
  execution: {
    acpConfig: AcpReviewerConfigState;
    formExecutionMode: 'provider' | 'acp';
    setFormExecutionMode: (val: 'provider' | 'acp') => void;
    formAcpAgentId: string;
    setFormAcpAgentId: (val: string) => void;
    formAllowAcpSourceTransfer: boolean;
    setFormAllowAcpSourceTransfer: (val: boolean) => void;
    formAcpConfigOptions: AcpReviewConfigOverrides;
    setFormAcpConfigOptions: React.Dispatch<React.SetStateAction<AcpReviewConfigOverrides>>;
    formProvider: string;
    setFormProvider: (val: string) => void;
    formModel: string;
    setFormModel: (val: string) => void;
    isCustomModel: boolean;
    setIsCustomModel: (val: boolean) => void;
    formTemp: number;
    setFormTemp: (val: number) => void;
    formReasoningEffort: AiReasoningEffort | undefined;
    setFormReasoningEffort: (val: AiReasoningEffort | undefined) => void;
    formFastMode: boolean;
    setFormFastMode: (val: boolean) => void;
  };
  catalog: {
    externalAgents: AcpAgentConfig[];
    globalAiConfig: AiConfig;
    providerPreset: AiProviderPreset | undefined;
    effectiveProvider: string;
    inheritsGlobalModel: boolean;
    availableModels: AiModelPreset[];
    executionModel: AiModelPreset | undefined;
    executionBaseUrl: string;
    dynamicModels: Record<string, AiModelPreset[]>;
  };
}
