import React from 'react';
import type { MentionOption } from '../../types/MentionOption';

export interface MarkdownFooterActionsProps {
  showActions: boolean;
  mentionOptions: MentionOption[];
  onGenerateDraft: (() => void) | undefined;
  disabled: boolean;
  isSubmitting: boolean;
  extraActions: React.ReactNode;
  onCancel: (() => void) | undefined;
  cancelLabel: string;
  onSubmit: (() => void) | undefined;
  value: string;
  submitLabel: string;
}
