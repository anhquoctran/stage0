import React, { useMemo } from 'react';
import { Marked } from 'marked';
import hljs from 'highlight.js';
import { sanitizeHtml } from '../utils/sanitizeHtml';
import type { MarkdownPreviewProps } from '../types/MarkdownPreviewProps';
import { parseMentionReference } from '../utils/mentions';

const markedInstance = new Marked({
  gfm: true,
  breaks: true,
});

markedInstance.use({
  renderer: {
    code({ text, lang }) {
      const validLang = lang && hljs.getLanguage(lang) ? lang : undefined;
      let highlighted = '';
      if (validLang) {
        try {
          highlighted = hljs.highlight(text, { language: validLang, ignoreIllegals: true }).value;
        } catch {
          highlighted = hljs.highlightAuto(text).value;
        }
      } else {
        try {
          highlighted = hljs.highlightAuto(text).value;
        } catch {
          highlighted = text;
        }
      }
      const langClass = validLang ? ` language-${validLang}` : '';
      return `<pre><code class="hljs${langClass}">${highlighted}</code></pre>\n`;
    },
  },
});

export const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({
  content,
  className = '',
  emptyPlaceholder = 'No content to preview...',
}) => {
  const html = useMemo(() => {
    if (!content || !content.trim()) return '';
    try {
      const parsed = markedInstance.parse(content) as string;
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
      className={`markdown-preview text-text leading-relaxed select-text ${className}`}
      style={{
        fontFamily: 'var(--markdown-font-family, inherit)',
        fontSize: 'var(--markdown-font-size, 0.75rem)',
      }}
      onClick={(event) => {
        const link = (event.target as HTMLElement).closest?.('a');
        if (parseMentionReference(link?.getAttribute('href') ?? '')) event.preventDefault();
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
