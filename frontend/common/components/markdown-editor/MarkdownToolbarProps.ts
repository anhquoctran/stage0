import React from 'react';

export interface MarkdownToolbarProps {
  setActiveTab: React.Dispatch<React.SetStateAction<'write' | 'preview'>>;
  activeTab: 'write' | 'preview';
  insertMarkdown: (prefix: string, suffix?: string, defaultText?: string) => void;
  disabled: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleImageFiles: (files: FileList | File[]) => Promise<void>;
  isSubmitting: boolean;
  isAttaching: boolean;
}
