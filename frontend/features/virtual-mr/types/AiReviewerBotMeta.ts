import type { BotCategory } from './BotCategory';

export interface AiReviewerBotMeta {
  id: string;
  name: string;
  tagline?: string;
  category?: BotCategory;
  avatarEmoji?: string;
  description?: string;
  defaultRules?: string;
}
