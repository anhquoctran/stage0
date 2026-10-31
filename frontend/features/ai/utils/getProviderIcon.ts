import { Cog } from '../../../common/components/icons/Cog';
import {
  OpenAiIcon,
  DeepSeekIcon,
  AnthropicIcon,
  GeminiIcon,
  XaiGrokIcon,
  QwenIcon,
  KimiIcon,
  ZaiIcon,
  OpenCodeIcon,
  OllamaIcon,
} from '../components/icons';

export const getProviderIcon = (providerId: string) => {
  switch (providerId) {
    case 'openai':
      return OpenAiIcon;
    case 'deepseek':
      return DeepSeekIcon;
    case 'anthropic':
      return AnthropicIcon;
    case 'gemini':
      return GeminiIcon;
    case 'xai_grok':
      return XaiGrokIcon;
    case 'qwen':
      return QwenIcon;
    case 'kimi':
      return KimiIcon;
    case 'zai':
      return ZaiIcon;
    case 'opencode':
      return OpenCodeIcon;
    case 'ollama':
      return OllamaIcon;
    case 'custom':
    default:
      return Cog;
  }
};

