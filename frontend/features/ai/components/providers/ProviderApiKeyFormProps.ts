import React from 'react';
import { type AiConfig } from '../../types/AiConfig';
import { type AiProviderId } from '../../types/AiProviderId';
import type { AiProviderPreset } from '../../types/AiProviderPreset';

export interface ProviderApiKeyFormProps {
  activeProviderPreset: AiProviderPreset;
  apiKeyDraft: string;
  hasDraftSettings: boolean | undefined;
  hasSavedApiKey: boolean;
  apiKeysConfigured: Record<string, boolean>;
  aiConfig: AiConfig;
  showApiKey: boolean;
  setApiKeyDraft: (key: string) => void;
  onUpdateAiConfig: (partial: Partial<AiConfig>) => void;
  setShowApiKey: React.Dispatch<React.SetStateAction<boolean>>;
  isCheckingApiKey: boolean;
  onLoadApiKey: (provider: AiProviderId) => void;
  apiKeyCheckError: string | null;
}
