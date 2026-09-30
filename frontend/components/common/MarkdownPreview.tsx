import React, { useMemo } from 'react';
import { marked } from 'marked';

interface MarkdownPreviewProps {
  content: string;
  className?: string;
  emptyPlaceholder?: string;
}

export const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({
  content,
  className = '',
  emptyPlaceholder = 'No content to preview...',
}) => {
  const html = useMemo(() => {
    if (!content || !content.trim()) return '';
    try {
      return marked.parse(content, { gfm: true, breaks: true }) as string;
    } catch {
      return content;
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
