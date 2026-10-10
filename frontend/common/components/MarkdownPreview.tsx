import React, { useMemo } from 'react';
import { marked } from 'marked';
import { sanitizeHtml } from '../utils/sanitizeHtml';
import type { MarkdownPreviewProps } from '../types/MarkdownPreviewProps';

export const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({
  content,
  className = '',
  emptyPlaceholder = 'No content to preview...',
}) => {
  const html = useMemo(() => {
    if (!content || !content.trim()) return '';
    try {
      const parsed = marked.parse(content, { gfm: true, breaks: true }) as string;
      return sanitizeHtml(parsed);
    } catch {
      return sanitizeHtml(content);
    }
  }, [content]);

  if (!html) {
    return (
      <div className={`text-subtext0/60 italic text-xs py-2 select-none ${className}`}>
        {emptyPlaceholder}
      </div>
    );
  }

  return (
    <div
      className={`markdown-preview text-xs text-text leading-relaxed select-text ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
