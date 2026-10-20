import type { BotCategory } from './BotCategory';
import type { AiReasoningEffort } from '../../ai/types/AiReasoningEffort';

export interface BotReviewer {
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: BotCategory;
  avatarEmoji: string;
  customInstructions: string;
  provider?: string;
  model?: string;
  /** Installed ACP agent reference; when set this reviewer runs through ACP instead of a built-in LLM provider. */
  acpAgentId?: string;
  /** Explicit per-reviewer consent to send eligible, redacted source to this ACP agent. */
  allowAcpSourceTransfer?: boolean;
  temperature?: number;
  reasoningEffort?: AiReasoningEffort;
  fastMode?: boolean;
  enabled: boolean;
  isBuiltin?: boolean;
}
