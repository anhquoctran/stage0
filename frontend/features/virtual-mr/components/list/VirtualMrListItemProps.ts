import type { BotReviewer } from '../../types/BotReviewer';
import type { VirtualMrSession } from '../../types/VirtualMrSession';

export interface VirtualMrListItemProps {
  session: VirtualMrSession;
  handleSelect: (sessionId: string) => Promise<void>;
  statusLabel: string;
  sequenceNumber: number;
  createdLabel: string;
  globalReviewers: BotReviewer[];
  BOT_DEFAULT_EMOJIS: Record<string, string>;
  updatedLabel: string;
}
