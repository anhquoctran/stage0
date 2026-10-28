import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { notificationService } from '../../../features/notifications/services/notificationService';
import { isAllowedImage, processAndSaveImage } from '../../utils/imageAttachment';

export function useMarkdownImageDrop(
  textareaRef: React.RefObject<HTMLTextAreaElement | null>,
  value: string,
  onChange: (value: string) => void,
  disabled: boolean,
  isSubmitting: boolean
) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [attachmentWarningKey, setAttachmentWarningKey] = useState<string | null>(null);
  const [isAttaching, setIsAttaching] = useState(false);
  const insertImageMarkdown = (markdownSnippet: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      onChange(value ? `${value}\n\n${markdownSnippet}` : markdownSnippet);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentVal = textarea.value;

    const prefix = start > 0 && currentVal[start - 1] !== '\n' ? '\n' : '';
    const suffix = end < currentVal.length && currentVal[end] !== '\n' ? '\n' : '';
    const replacement = `${prefix}${markdownSnippet}${suffix}`;
    const nextVal = currentVal.substring(0, start) + replacement + currentVal.substring(end);
    onChange(nextVal);

    requestAnimationFrame(() => {
      textarea.focus();
      const nextCursor = start + replacement.length;
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const handleImageFiles = async (files: FileList | File[]) => {
    if (disabled || isSubmitting) return;
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    let hasRejected = false;
    setIsAttaching(true);

    try {
      for (const file of fileArray) {
        if (!isAllowedImage(file)) {
          hasRejected = true;
          continue;
        }

        const saved = await processAndSaveImage(file);
        if (saved) {
          const markdownImg = `![${file.name || 'image'}](${saved.dataUrl})`;
          insertImageMarkdown(markdownImg);
        } else {
          hasRejected = true;
        }
      }

      if (hasRejected) {
        setAttachmentWarningKey('attachments.allowedTypes');
        notificationService.notify({
          titleKey: 'attachments.unsupportedTitle',
          bodyKey: 'attachments.allowedTypes',
          level: 'warning',
          channel: 'guardrails',
        });
        setTimeout(() => setAttachmentWarningKey(null), 5000);
      }
    } finally {
      setIsAttaching(false);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (disabled || isSubmitting) return;
    const clipboardData = e.clipboardData;
    if (!clipboardData) return;

    const files = Array.from(clipboardData.files);
    const imageItems = Array.from(clipboardData.items).filter(
      (item) => item.kind === 'file' && item.type.startsWith('image/')
    );

    if (files.length > 0 || imageItems.length > 0) {
      const targetFiles: File[] = [];
      if (files.length > 0) {
        targetFiles.push(...files);
      } else {
        for (const item of imageItems) {
          const file = item.getAsFile();
          if (file) targetFiles.push(file);
        }
      }

      if (targetFiles.length > 0) {
        e.preventDefault();
        handleImageFiles(targetFiles);
      }
    }
  };

  return {
    fileInputRef,
    isDraggingOver,
    setIsDraggingOver,
    attachmentWarning: attachmentWarningKey ? t(attachmentWarningKey) : null,
    setAttachmentWarning: (message: string | null) => setAttachmentWarningKey(message),
    isAttaching,
    handleImageFiles,
    handlePaste,
  };
}
