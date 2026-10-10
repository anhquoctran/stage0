import type { BotCategory } from './BotCategory';

export interface BotReviewer {
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: BotCategory;
  avatarEmoji: string;
  systemPrompt: string;
  provider?: string;
  model?: string;
  temperature?: number;
  enabled: boolean;
  isBuiltin?: boolean;
}
