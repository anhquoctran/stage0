import React, { useId, useState, useRef } from 'react';
import { Bold } from './icons/Bold';
import { Italic } from './icons/Italic';
import { Heading } from './icons/Heading';
import { Code } from './icons/Code';
import { SquareCode } from './icons/SquareCode';
import { Quote } from './icons/Quote';
import { List } from './icons/List';
import { ListOrdered } from './icons/ListOrdered';
import { CheckSquare } from './icons/CheckSquare';
import { Link } from './icons/Link';
import { Eye } from './icons/Eye';
import { PenLine } from './icons/PenLine';
import { Sparkles } from './icons/Sparkles';
import { MarkdownPreview } from './MarkdownPreview';
import { formatShortcutText } from '../utils/shortcuts';
import type { MarkdownEditorProps } from '../types/MarkdownEditorProps';
import { formatMention, getMentionQuery } from '../utils/mentions';
import type { MentionOption } from '../types/MentionOption';

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  value,
  onChange,
  placeholder = '',
  rows = 4,
  minHeight = '100px',
  maxHeight = '320px',
  autoFocus = false,
  disabled = false,
  className = '',
  onSubmit,
  submitLabel = 'Submit',
  onCancel,
  cancelLabel = 'Cancel',
  showActions = false,
  isSubmitting = false,
  onGenerateDraft,
  extraActions,
  mentionOptions = [],
}) => {
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionListId = useId();
  const [mentionCaret, setMentionCaret] = useState(0);
  const [isMentionFocused, setIsMentionFocused] = useState(false);
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);
  const mentionQuery = mentionOptions.length && !disabled && !isSubmitting && isMentionFocused && activeTab === 'write'
    ? getMentionQuery(value, mentionCaret) : null;
  const suggestions = mentionQuery ? mentionOptions.filter((item) =>
    `${item.label} ${item.id}`.toLocaleLowerCase().includes(mentionQuery.query)) : [];
  const selectedMentionIndex = Math.min(activeMentionIndex, Math.max(0, suggestions.length - 1));

  const applyMention = (option: MentionOption) => {
    if (!mentionQuery) return;
    const inserted = formatMention(option);
    const after = value.slice(mentionQuery.end);
    const separator = /^[\s.,;:!?)]/.test(after) ? '' : ' ';
    const nextCaret = mentionQuery.start + inserted.length + separator.length;
    onChange(`${value.slice(0, mentionQuery.start)}${inserted}${separator}${after}`);
    setIsMentionFocused(false);
    setMentionCaret(nextCaret);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(nextCaret, nextCaret);
    });
  };

  const insertMarkdown = (prefix: string, suffix = '', defaultText = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentVal = textarea.value;
    const selectedText = currentVal.substring(start, end) || defaultText;

    const replacement = prefix + selectedText + suffix;
    const nextVal = currentVal.substring(0, start) + replacement + currentVal.substring(end);
    onChange(nextVal);

    setTimeout(() => {
      textarea.focus();
      const cursorStart = start + prefix.length;
      const cursorEnd = cursorStart + selectedText.length;
      textarea.setSelectionRange(cursorStart, cursorEnd);
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (disabled || isSubmitting) return;
    if (suggestions.length) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveMentionIndex((selectedMentionIndex + (e.key === 'ArrowDown' ? 1 : -1) + suggestions.length) % suggestions.length);
        return;
      }
      if ((e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.shiftKey) || e.key === 'Tab') {
        e.preventDefault();
        applyMention(suggestions[selectedMentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault(); e.stopPropagation(); setIsMentionFocused(false); return;
      }
    }
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modifier = isMac ? e.metaKey : e.ctrlKey;

    if (modifier && e.key === 'b') {
      e.preventDefault();
      insertMarkdown('**', '**', 'bold text');
    } else if (modifier && e.key === 'i') {
      e.preventDefault();
      insertMarkdown('*', '*', 'italic text');
    } else if (modifier && e.key === 'k') {
      e.preventDefault();
      insertMarkdown('[', '](https://example.com)', 'link text');
    } else if (modifier && e.key === 'Enter' && onSubmit) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className={`border border-surface1 bg-mantle text-xs space-y-0 overflow-hidden focus-within:border-blue focus-within:ring-1 focus-within:ring-blue/30 transition-all ${className}`}>
      {/* Top Header: Tabs (Write / Preview) & GitLab Formatting Toolbar */}
      <div className="flex items-center justify-between border-b border-surface1 bg-surface0/60 px-2 py-1 gap-1 flex-wrap select-none">
        {/* Write / Preview Tab Switcher */}
        <div className="flex items-center gap-1 pr-1 border-r border-surface1">
          <button
            type="button"
            onClick={() => setActiveTab('write')}
            className={`flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium cursor-pointer transition-colors ${
              activeTab === 'write'
                ? 'bg-surface2 text-text shadow-xs font-semibold'
                : 'text-subtext0 hover:text-text hover:bg-surface1'
            }`}
            title="Write"
          >
            <PenLine className="w-3.5 h-3.5" />
            <span>Write</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium cursor-pointer transition-colors ${
              activeTab === 'preview'
                ? 'bg-surface2 text-text shadow-xs font-semibold'
                : 'text-subtext0 hover:text-text hover:bg-surface1'
            }`}
            title="Preview Markdown"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Preview</span>
          </button>
        </div>

        {/* Toolbar (Only available in Write tab) matching GitLab screenshot */}
        {activeTab === 'write' ? (
          <div className="flex items-center gap-0.5 flex-wrap">
            {/* Insert suggestion */}
            <button
              type="button"
              onClick={() => insertMarkdown('```suggestion\n', '\n```', '// proposed change')}
              disabled={disabled}
              className="p-1 text-subtext0 hover:text-text hover:bg-surface1 transition-colors cursor-pointer disabled:opacity-40"
              title="Insert suggestion"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="9" y1="13" x2="15" y2="13" />
                <line x1="12" y1="10" x2="12" y2="16" />
              </svg>
            </button>

            <span className="w-px h-3 bg-surface1 mx-0.5" />

            <button
              type="button"
              onClick={() => insertMarkdown('**', '**', 'bold text')}
              disabled={disabled}
              className="p-1 text-subtext0 hover:text-text hover:bg-surface1 transition-colors cursor-pointer disabled:opacity-40"
              title={formatShortcutText('Bold (Ctrl+B)')}
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertMarkdown('*', '*', 'italic text')}
              disabled={disabled}
              className="p-1 text-subtext0 hover:text-text hover:bg-surface1 transition-colors cursor-pointer disabled:opacity-40"
              title={formatShortcutText('Italic (Ctrl+I)')}
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertMarkdown('~~', '~~', 'strikethrough text')}
              disabled={disabled}
              className="p-1 text-subtext0 hover:text-text hover:bg-surface1 transition-colors cursor-pointer disabled:opacity-40 font-bold text-xs w-5 text-center leading-none"
              title="Strikethrough"
            >
              <s>S</s>
            </button>

            <span className="w-px h-3 bg-surface1 mx-0.5" />

            <button
              type="button"
              onClick={() => insertMarkdown('### ', '', 'Heading')}
              disabled={disabled}
              className="p-1 text-subtext0 hover:text-text hover:bg-surface1 transition-colors cursor-pointer disabled:opacity-40"
              title="Heading"
            >
              <Heading className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertMarkdown('`', '`', 'code')}
              disabled={disabled}
              className="p-1 text-subtext0 hover:text-text hover:bg-surface1 transition-colors cursor-pointer disabled:opacity-40"
              title="Inline code"
            >
              <Code className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertMarkdown('[', '](https://example.com)', 'link text')}
              disabled={disabled}
              className="p-1 text-subtext0 hover:text-text hover:bg-surface1 transition-colors cursor-pointer disabled:opacity-40"
              title={formatShortcutText('Insert link (Ctrl+K)')}
            >
              <Link className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => insertMarkdown('- ', '', 'List item')}
              disabled={disabled}
              className="p-1 text-subtext0 hover:text-text hover:bg-surface1 transition-colors cursor-pointer disabled:opacity-40"
              title="Bullet list"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertMarkdown('1. ', '', 'Numbered item')}
              disabled={disabled}
              className="p-1 text-subtext0 hover:text-text hover:bg-surface1 transition-colors cursor-pointer disabled:opacity-40"
              title="Numbered list"
            >
              <ListOrdered className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertMarkdown('- [ ] ', '', 'Task item')}
              disabled={disabled}
              className="p-1 text-subtext0 hover:text-text hover:bg-surface1 transition-colors cursor-pointer disabled:opacity-40"
              title="Task list"
            >
              <CheckSquare className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertMarkdown('> ', '', 'Quote')}
              disabled={disabled}
              className="p-1 text-subtext0 hover:text-text hover:bg-surface1 transition-colors cursor-pointer disabled:opacity-40"
              title="Quote"
            >
              <Quote className="h-3.5 w-3.5" />
            </button>

            {/* Table */}
            <button
              type="button"
              onClick={() => insertMarkdown('| Header 1 | Header 2 |\n| --- | --- |\n| Cell 1 | Cell 2 |\n', '', '')}
              disabled={disabled}
              className="p-1 text-subtext0 hover:text-text hover:bg-surface1 transition-colors cursor-pointer disabled:opacity-40"
              title="Insert table"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="3" />
                <path d="M3 9h18" />
                <path d="M3 15h18" />
                <path d="M9 3v18" />
                <path d="M15 3v18" />
              </svg>
            </button>

            {/* Attach file */}
            <button
              type="button"
              onClick={() => insertMarkdown('![alt text](', ')', 'image-url')}
              disabled={disabled}
              className="p-1 text-subtext0 hover:text-text hover:bg-surface1 transition-colors cursor-pointer disabled:opacity-40"
              title="Attach a file"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => insertMarkdown('```\n', '\n```', 'code block')}
              disabled={disabled}
              className="p-1 text-subtext0 hover:text-text hover:bg-surface1 transition-colors cursor-pointer disabled:opacity-40"
              title="Code block"
            >
              <SquareCode className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <span className="text-[11px] text-subtext0 font-mono italic">
            Preview Markdown
          </span>
        )}
      </div>

      {/* Editor Body: Textarea OR MarkdownPreview */}
      <div className="bg-crust/40">
        {activeTab === 'write' ? (
          <>
            <textarea
              ref={textareaRef}
              rows={rows}
              value={value}
              onChange={(e) => {
                onChange(e.target.value);
                setMentionCaret(e.target.selectionStart);
                setActiveMentionIndex(0);
                setIsMentionFocused(true);
              }}
              onSelect={(e) => {
                setMentionCaret(e.currentTarget.selectionStart);
                if (e.currentTarget.selectionStart !== e.currentTarget.selectionEnd) setIsMentionFocused(false);
              }}
              onFocus={(e) => { setIsMentionFocused(true); setMentionCaret(e.currentTarget.selectionStart); }}
              onBlur={() => setIsMentionFocused(false)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder || 'Write a comment or drag your files here...'}
              autoFocus={autoFocus}
              disabled={disabled || isSubmitting}
              role={mentionOptions.length ? 'combobox' : undefined}
              aria-autocomplete={mentionOptions.length ? 'list' : undefined}
              aria-expanded={mentionOptions.length ? suggestions.length > 0 : undefined}
              aria-controls={suggestions.length ? mentionListId : undefined}
              aria-activedescendant={suggestions.length ? `${mentionListId}-${selectedMentionIndex}` : undefined}
              style={{ minHeight, maxHeight }}
              className="w-full p-3 bg-base/50 text-text text-xs font-mono placeholder:text-subtext0/60 focus:outline-none transition-colors resize-y leading-relaxed border-0"
            />

            {/* Bottom Sub-bar matching GitLab: "Switch to rich text editing" & "M+" */}
            <div className="flex items-center justify-between px-3 py-1.5 border-t border-surface0/60 bg-mantle/40 text-[11px] text-subtext0 select-none">
              <span className="text-subtext0 hover:text-blue hover:underline cursor-pointer">
                Switch to rich text editing
              </span>
              <span className="font-mono text-[10px] px-1 py-0.2 border border-surface1 text-subtext0 bg-surface0/50" title="GitLab Flavored Markdown supported">
                M+
              </span>
            </div>

            {suggestions.length > 0 && (
              <div id={mentionListId} role="listbox" aria-label="Mention a participant" className="mt-1 max-h-40 overflow-y-auto border border-surface1 bg-mantle shadow-lg">
                {suggestions.map((option, index) => (
                  <button key={`${option.kind}:${option.id}`} type="button" role="option" id={`${mentionListId}-${index}`} title={option.id}
                    aria-selected={selectedMentionIndex === index} onMouseDown={(e) => e.preventDefault()} onClick={() => applyMention(option)}
                    className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs ${selectedMentionIndex === index ? 'bg-surface1 text-text' : 'text-subtext1 hover:bg-surface0'}`}>
                    <span className="min-w-0 truncate font-medium">@{option.label}
                      {mentionOptions.some((other) => other.id !== option.id && other.kind === option.kind && other.label === option.label)
                        && <span className="ml-2 font-mono text-[10px] font-normal text-subtext0">{option.id}</span>}
                    </span>
                    <span className="shrink-0 text-[10px] text-subtext0">{option.kind === 'reviewer' ? 'AI reviewer' : 'Assignee'}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div
            style={{ minHeight, maxHeight }}
            className="w-full p-3 bg-base border-0 overflow-y-auto"
          >
            <MarkdownPreview content={value} emptyPlaceholder="No content to preview" />
          </div>
        )}
      </div>

      {/* Action Bar / Bottom Bar */}
      {(showActions || onGenerateDraft) && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-surface1 bg-base/50 gap-2 select-none">
          <div className="flex items-center gap-2 text-[10px] text-subtext0 font-mono">
            {showActions && (
              <span>
                {mentionOptions.length > 0 && <span>Type @ to mention · </span>}
                Tip: Press <kbd className="px-1 py-0.5 bg-surface0 border border-surface1">Ctrl</kbd> + <kbd className="px-1 py-0.5 bg-surface0 border border-surface1">Enter</kbd> to submit
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onGenerateDraft && (
              <button
                type="button"
                onClick={onGenerateDraft}
                disabled={disabled || isSubmitting}
                className="p-1 text-subtext0 hover:text-purple-300 hover:bg-surface1 active:bg-surface2 transition-colors cursor-pointer disabled:opacity-40"
                title="Generate draft from commit metadata (no AI request)"
                aria-label="Generate draft from commit metadata"
              >
                <Sparkles className="w-3.5 h-3.5" />
              </button>
            )}

            {extraActions}

            {showActions && onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={isSubmitting}
                className="px-3 py-1 bg-surface1 hover:bg-surface2 active:bg-surface0 text-white text-xs transition-colors cursor-pointer"
              >
                {cancelLabel}
              </button>
            )}

            {showActions && onSubmit && (
              <button
                type="button"
                onClick={onSubmit}
                disabled={isSubmitting || !value.trim()}
                className="px-4 py-1 bg-brand hover:bg-brand/90 text-on-accent font-semibold text-xs transition-colors cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Submitting...' : submitLabel}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export type { MarkdownEditorProps } from '../types/MarkdownEditorProps';
