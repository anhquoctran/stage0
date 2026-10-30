import React, { useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getMarkdownFormattingAtCaret } from '../utils/markdownFormatting';
import type { MarkdownEditorProps } from '../types/MarkdownEditorProps';
import type { MentionOption } from '../types/MentionOption';
import { formatMention, getMentionQuery } from '../utils/mentions';
import { MarkdownFooterActions } from './markdown-editor/MarkdownFooterActions';
import { MarkdownMentionPopup } from './markdown-editor/MarkdownMentionPopup';
import { MarkdownToolbar } from './markdown-editor/MarkdownToolbar';
import { useMarkdownImageDrop } from './markdown-editor/useMarkdownImageDrop';
import { MarkdownPreview } from './MarkdownPreview';

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  value,
  onChange,
  placeholder = '',
  rows = 8,
  minHeight = '180px',
  maxHeight = '650px',
  autoFocus = false,
  disabled = false,
  className = '',
  onSubmit,
  submitLabel,
  onCancel,
  cancelLabel,
  showActions = false,
  isSubmitting = false,
  onGenerateDraft,
  extraActions,
  mentionOptions = [],
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionListId = useId();
  const [mentionCaret, setMentionCaret] = useState(0);
  const [isMentionFocused, setIsMentionFocused] = useState(false);
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);
  const [selectionRange, setSelectionRange] = useState({ start: 0, end: 0 });

  const activeFormats = useMemo(() => {
    return getMarkdownFormattingAtCaret(value, selectionRange.start, selectionRange.end);
  }, [value, selectionRange.start, selectionRange.end]);
  const {
    fileInputRef,
    isDraggingOver,
    setIsDraggingOver,
    attachmentWarning,
    setAttachmentWarning,
    isAttaching,
    handleImageFiles,
    handlePaste,
  } = useMarkdownImageDrop(textareaRef, value, onChange, disabled, isSubmitting);
  const mentionQuery =
    mentionOptions.length && !disabled && !isSubmitting && isMentionFocused && activeTab === 'write'
      ? getMentionQuery(value, mentionCaret)
      : null;
  const suggestions = mentionQuery
    ? mentionOptions.filter((item) =>
        `${item.label} ${item.id}`.toLocaleLowerCase().includes(mentionQuery.query)
      )
    : [];
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
      setSelectionRange({ start: cursorStart, end: cursorEnd });
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (disabled || isSubmitting) return;
    if (suggestions.length) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveMentionIndex(
          (selectedMentionIndex + (e.key === 'ArrowDown' ? 1 : -1) + suggestions.length) %
            suggestions.length
        );
        return;
      }
      if ((e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.shiftKey) || e.key === 'Tab') {
        e.preventDefault();
        applyMention(suggestions[selectedMentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setIsMentionFocused(false);
        return;
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
    <div
      className={`markdown-editor border border-surface1 bg-mantle text-xs space-y-0 overflow-hidden rounded-sm focus-within:border-brand focus-within:ring-1 focus-within:ring-brand/30 transition-all ${className}`}
    >
      {/* Top Header: Tabs (Write / Preview) & GitLab Formatting Toolbar */}
      <MarkdownToolbar
        setActiveTab={setActiveTab}
        activeTab={activeTab}
        insertMarkdown={insertMarkdown}
        disabled={disabled}
        fileInputRef={fileInputRef}
        handleImageFiles={handleImageFiles}
        isSubmitting={isSubmitting}
        isAttaching={isAttaching}
        activeFormats={activeFormats}
      />

      {/* Editor Body: Textarea OR MarkdownPreview */}
      <div
        className="bg-crust/40 relative"
        onDragOver={(e) => {
          if (disabled || isSubmitting) return;
          e.preventDefault();
          e.stopPropagation();
          setIsDraggingOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDraggingOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDraggingOver(false);
          if (disabled || isSubmitting) return;
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleImageFiles(e.dataTransfer.files);
          }
        }}
      >
        {isDraggingOver && (
          <div className="absolute inset-0 bg-blue/15 border-2 border-dashed border-blue flex flex-col items-center justify-center pointer-events-none z-20 text-xs font-semibold text-blue gap-1 backdrop-blur-xs">
            <span>{t('common.markdown.dropImages')}</span>
            <span className="text-[10px] text-blue/80 font-normal">{t('common.markdown.imageFormats')}</span>
          </div>
        )}

        {activeTab === 'write' ? (
          <>
            <textarea
              ref={textareaRef}
              rows={rows}
              value={value}
              onChange={(e) => {
                onChange(e.target.value);
                setMentionCaret(e.target.selectionStart);
                setSelectionRange({
                  start: e.target.selectionStart,
                  end: e.target.selectionEnd,
                });
                setActiveMentionIndex(0);
                setIsMentionFocused(true);
              }}
              onSelect={(e) => {
                setMentionCaret(e.currentTarget.selectionStart);
                setSelectionRange({
                  start: e.currentTarget.selectionStart,
                  end: e.currentTarget.selectionEnd,
                });
                if (e.currentTarget.selectionStart !== e.currentTarget.selectionEnd)
                  setIsMentionFocused(false);
              }}
              onFocus={(e) => {
                setIsMentionFocused(true);
                setMentionCaret(e.currentTarget.selectionStart);
                setSelectionRange({
                  start: e.currentTarget.selectionStart,
                  end: e.currentTarget.selectionEnd,
                });
              }}
              onKeyUp={(e) => {
                setSelectionRange({
                  start: e.currentTarget.selectionStart,
                  end: e.currentTarget.selectionEnd,
                });
              }}
              onClick={(e) => {
                setSelectionRange({
                  start: e.currentTarget.selectionStart,
                  end: e.currentTarget.selectionEnd,
                });
              }}
              onBlur={() => setIsMentionFocused(false)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={placeholder || t('common.markdown.commentPlaceholder')}
              autoFocus={autoFocus}
              disabled={disabled || isSubmitting}
              role={mentionOptions.length ? 'combobox' : undefined}
              aria-autocomplete={mentionOptions.length ? 'list' : undefined}
              aria-expanded={mentionOptions.length ? suggestions.length > 0 : undefined}
              aria-controls={suggestions.length ? mentionListId : undefined}
              aria-activedescendant={
                suggestions.length ? `${mentionListId}-${selectedMentionIndex}` : undefined
              }
              style={{ minHeight, maxHeight }}
              className="markdown-editor-textarea w-full p-3 bg-base/50 text-text text-xs font-mono placeholder:text-subtext0/60 focus:outline-none transition-colors resize-y leading-relaxed border-0"
            />

            {suggestions.length > 0 && (
              <MarkdownMentionPopup
                mentionListId={mentionListId}
                suggestions={suggestions}
                selectedMentionIndex={selectedMentionIndex}
                applyMention={applyMention}
                mentionOptions={mentionOptions}
              />
            )}

            {attachmentWarning && (
              <div className="px-3 py-1.5 bg-yellow-900/30 border-t border-yellow-700/50 text-yellow-200 text-[11px] flex items-center justify-between rounded-sm">
                <div className="flex items-center gap-1.5">
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-yellow-400 shrink-0"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{attachmentWarning}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setAttachmentWarning(null)}
                  className="text-yellow-400 hover:text-yellow-100 ms-2 font-bold cursor-pointer rounded-sm"
                  title={t('common.markdown.dismissWarning')}
                >
                  ×
                </button>
              </div>
            )}
          </>
        ) : (
          <div
            style={{ minHeight, maxHeight }}
            className="w-full p-3 bg-base border-0 overflow-y-auto rounded-sm"
          >
            <MarkdownPreview content={value} emptyPlaceholder={t('common.markdown.noContentToPreview')} />
          </div>
        )}
      </div>

      {/* Action Bar / Bottom Bar */}
      {(showActions || onGenerateDraft) && (
        <MarkdownFooterActions
          showActions={showActions}
          mentionOptions={mentionOptions}
          onGenerateDraft={onGenerateDraft}
          disabled={disabled}
          isSubmitting={isSubmitting}
          extraActions={extraActions}
          onCancel={onCancel}
          cancelLabel={cancelLabel || t('common.cancel')}
          onSubmit={onSubmit}
          value={value}
          submitLabel={submitLabel || t('common.markdown.submit')}
        />
      )}
    </div>
  );
};

export type { MarkdownEditorProps } from '../types/MarkdownEditorProps';
