import React from 'react';

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
  onAiGenerate?: () => void;
  extraActions?: React.ReactNode;
}
