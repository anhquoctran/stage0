import React from 'react';
import type { MentionOption } from './MentionOption';

export interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  minHeight?: string;
  maxHeight?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  className?: string;
  onSubmit?: () => void;
  submitLabel?: string;
  onCancel?: () => void;
  cancelLabel?: string;
  showActions?: boolean;
  isSubmitting?: boolean;
  onGenerateDraft?: () => void;
  extraActions?: React.ReactNode;
  mentionOptions?: MentionOption[];
}
