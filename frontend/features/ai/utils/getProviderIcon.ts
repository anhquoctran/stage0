import { Sparkles } from '../../../common/components/icons/Sparkles';
import { Bot } from '../../../common/components/icons/Bot';
import { Globe } from '../../../common/components/icons/Globe';
import { Zap } from '../../../common/components/icons/Zap';
import { HardDrive } from '../../../common/components/icons/HardDrive';
import { Cog } from '../../../common/components/icons/Cog';
import { SquareCode } from '../../../common/components/icons/SquareCode';

export const getProviderIcon = (providerId: string) => {
  switch (providerId) {
    case 'openai':
      return Sparkles;
    case 'anthropic':
      return Bot;
    case 'gemini':
      return Globe;
    case 'xai_grok':
      return Zap;
    case 'deepseek':
      return Sparkles;
    case 'qwen':
      return Bot;
    case 'kimi':
      return Globe;
    case 'zai':
      return Zap;
    case 'opencode':
      return SquareCode;
    case 'ollama':
      return HardDrive;
    case 'custom':
    default:
      return Cog;
  }
};

