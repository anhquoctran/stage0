import { AI_PROVIDERS } from './aiPresets';
import { BOT_CATEGORIES } from './botPresets';
import type { BotCategory } from '../../virtual-mr/types/BotCategory';
import type { CustomSelectOption } from '../../../common/types/CustomSelectOption';

export const EMOJI_PRESETS = ['🛡️', '⚡', '🏗️', '🐛', '📝', '🎨', '🔒', '🚀', '🧪', '🔍', '⚙️', '💎'];
export const CUSTOM_MODEL_OPTION = '__stage0_custom_model__';

export const BOT_CATEGORY_OPTIONS: CustomSelectOption<BotCategory>[] = BOT_CATEGORIES.map((category) => ({
  value: category.id,
  label: category.label,
}));

export const BOT_PROVIDER_OPTIONS: CustomSelectOption<string>[] = [
  { value: 'global_default', label: 'Global Default (from AI tab)' },
  ...AI_PROVIDERS.map((provider) => ({ value: provider.id, label: provider.name })),
];

export const BOT_EXECUTION_OPTIONS: CustomSelectOption<'provider' | 'acp'>[] = [
  { value: 'provider', label: 'Built-in LLM provider' },
  { value: 'acp', label: 'ACP Agent' },
];

export const getCategoryInfo = (category: BotCategory) => {
  return BOT_CATEGORIES.find((c) => c.id === category) || BOT_CATEGORIES[0];
};

