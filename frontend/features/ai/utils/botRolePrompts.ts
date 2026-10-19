import prompts from '../constants/botRolePrompts.json';
import type { BotCategory } from '../../virtual-mr/types/BotCategory';

export const BOT_ROLE_PROMPTS: Record<BotCategory, string> = prompts;

export function getBotRolePrompt(role: BotCategory): string {
  return BOT_ROLE_PROMPTS[role] || BOT_ROLE_PROMPTS.custom;
}
