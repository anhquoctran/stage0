import type { BotCategory } from './BotCategory';
import type { AiReasoningEffort } from '../../ai/types/AiReasoningEffort';

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
  reasoningEffort?: AiReasoningEffort;
  fastMode?: boolean;
  enabled: boolean;
  isBuiltin?: boolean;
}
