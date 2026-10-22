import type { CustomSelectOption } from '../../../../common/types/CustomSelectOption';
import { type AiConfig } from '../../types/AiConfig';
import type { AiModelPreset } from '../../types/AiModelPreset';

export interface ProviderModelFormProps {
  isFetchingDynamicModels: boolean;
  apiKeyDraft: string;
  onFetchDynamicModels: (config: AiConfig) => void;
  aiConfig: AiConfig;
  modelOptions: CustomSelectOption<string>[];
  selectModel: (model: string) => void;
  dynamicModelError: string | null;
  selectedModelInfo: AiModelPreset | undefined;
  onUpdateAiConfig: (partial: Partial<AiConfig>) => void;
  parseFloat: (string: string) => number;
  String: StringConstructor;
  parseInt: (string: string, radix?: number) => number;
}
