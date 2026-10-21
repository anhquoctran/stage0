import { Sparkles } from '../../../common/components/icons/Sparkles';
import { Bot } from '../../../common/components/icons/Bot';
import { Globe } from '../../../common/components/icons/Globe';
import { Zap } from '../../../common/components/icons/Zap';
import { HardDrive } from '../../../common/components/icons/HardDrive';
import { Cog } from '../../../common/components/icons/Cog';

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
    case 'ollama':
      return HardDrive;
    case 'custom':
    default:
      return Cog;
  }
};

