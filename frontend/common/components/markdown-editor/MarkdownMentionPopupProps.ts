import type { MentionOption } from '../../types/MentionOption';

export interface MarkdownMentionPopupProps {
  mentionListId: string;
  suggestions: MentionOption[];
  selectedMentionIndex: number;
  applyMention: (option: MentionOption) => void;
  mentionOptions: MentionOption[];
}
