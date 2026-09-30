import React, { useState, useRef } from 'react';
import {
  Bold,
  Italic,
  Heading,
  Code,
  SquareCode,
  Quote,
  List,
  ListOrdered,
  CheckSquare,
  Link,
  Eye,
  PenLine,
  Sparkles,
} from 'lucide-react';
import { MarkdownPreview } from './MarkdownPreview';

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

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  value,
  onChange,
  placeholder = 'Enter markdown content...',
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
  onAiGenerate,
  extraActions,
}) => {
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    <div className={`border border-surface1 bg-mantle text-xs space-y-0 ${className}`}>
      {/* Top Header: Tabs (Write / Preview) & Formatting Toolbar */}
      <div className="flex items-center justify-between border-b border-surface1 bg-base/70 px-2 py-1 gap-2 flex-wrap select-none">
        {/* Write / Preview Tab Switcher */}
        <div className="flex items-center gap-1 border-r border-surface1 pr-2">
          <button
            type="button"
            onClick={() => setActiveTab('write')}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium cursor-pointer transition-colors ${
              activeTab === 'write'
                ? 'bg-surface1 text-text border border-surface2 shadow-xs'
                : 'text-subtext0 hover:text-text hover:bg-surface0'
            }`}
            title="Write"
          >
            <PenLine className="w-3.5 h-3.5 text-subtext0" />
            <span>Write</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium cursor-pointer transition-colors ${
              activeTab === 'preview'
                ? 'bg-surface1 text-text border border-surface2 shadow-xs'
                : 'text-subtext0 hover:text-text hover:bg-surface0'
            }`}
            title="Preview Markdown"
          >
            <Eye className="w-3.5 h-3.5 text-subtext0" />
            <span>Preview</span>
          </button>
        </div>

        {/* Toolbar (Only available in Write tab) */}
        {activeTab === 'write' ? (
          <div className="flex items-center gap-0.5 flex-wrap">
            <button
              type="button"
              onClick={() => insertMarkdown('**', '**', 'bold text')}
              disabled={disabled}
              className="p-1 rounded text-subtext0 hover:text-text hover:bg-surface1 transition-colors cursor-pointer disabled:opacity-40"
              title="Bold (Ctrl+B)"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertMarkdown('*', '*', 'italic text')}
              disabled={disabled}
              className="p-1 rounded text-subtext0 hover:text-text hover:bg-surface1 transition-colors cursor-pointer disabled:opacity-40"
              title="Italic (Ctrl+I)"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertMarkdown('### ', '', 'Heading')}
              disabled={disabled}
              className="p-1 rounded text-subtext0 hover:text-text hover:bg-surface1 transition-colors cursor-pointer disabled:opacity-40"
              title="Heading"
            >
              <Heading className="w-3.5 h-3.5" />
            </button>

            <span className="w-px h-3.5 bg-surface1 mx-1" />

            <button
              type="button"
              onClick={() => insertMarkdown('`', '`', 'code')}
              disabled={disabled}
              className="p-1 rounded text-subtext0 hover:text-text hover:bg-surface1 transition-colors cursor-pointer disabled:opacity-40"
              title="Inline code"
            >
              <Code className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertMarkdown('```\n', '\n```', 'code block')}
              disabled={disabled}
              className="p-1 rounded text-subtext0 hover:text-text hover:bg-surface1 transition-colors cursor-pointer disabled:opacity-40"
              title="Code block"
            >
              <SquareCode className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertMarkdown('> ', '', 'Quote')}
              disabled={disabled}
              className="p-1 rounded text-subtext0 hover:text-text hover:bg-surface1 transition-colors cursor-pointer disabled:opacity-40"
              title="Quote"
            >
              <Quote className="w-3.5 h-3.5" />
            </button>

            <span className="w-px h-3.5 bg-surface1 mx-1" />

            <button
              type="button"
              onClick={() => insertMarkdown('- ', '', 'List item')}
              disabled={disabled}
              className="p-1 rounded text-subtext0 hover:text-text hover:bg-surface1 transition-colors cursor-pointer disabled:opacity-40"
              title="Bullet list"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertMarkdown('1. ', '', 'Numbered item')}
              disabled={disabled}
              className="p-1 rounded text-subtext0 hover:text-text hover:bg-surface1 transition-colors cursor-pointer disabled:opacity-40"
              title="Numbered list"
            >
              <ListOrdered className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertMarkdown('- [ ] ', '', 'Task item')}
              disabled={disabled}
              className="p-1 rounded text-subtext0 hover:text-text hover:bg-surface1 transition-colors cursor-pointer disabled:opacity-40"
              title="Task list"
            >
              <CheckSquare className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertMarkdown('[', '](https://example.com)', 'link text')}
              disabled={disabled}
              className="p-1 rounded text-subtext0 hover:text-text hover:bg-surface1 transition-colors cursor-pointer disabled:opacity-40"
              title="Insert link (Ctrl+K)"
            >
              <Link className="w-3.5 h-3.5" />
            </button>

            {onAiGenerate && (
              <button
                type="button"
                onClick={onAiGenerate}
                disabled={disabled}
                className="flex items-center gap-1.5 px-2 py-0.5 ml-2 text-[11px] font-semibold bg-purple-500/15 hover:bg-purple-500/25 active:bg-purple-500/35 text-purple-300 hover:text-purple-200 border border-purple-500/30 transition-all cursor-pointer shadow-2xs"
                title="Generate description with AI"
              >
                <Sparkles className="w-3 h-3 text-purple-400" />
                <span>AI Generate</span>
              </button>
            )}
          </div>
        ) : (
          <span className="text-[11px] text-subtext0 font-mono italic">
            Preview Markdown
          </span>
        )}
      </div>

      {/* Editor Body: Textarea OR MarkdownPreview */}
      <div className="p-2.5 bg-crust/30">
        {activeTab === 'write' ? (
          <textarea
            ref={textareaRef}
            rows={rows}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            autoFocus={autoFocus}
            disabled={disabled}
            style={{ minHeight, maxHeight }}
            className="w-full p-2 bg-base border border-surface1 text-text text-xs font-mono placeholder:text-subtext0/60 focus:outline-none focus:border-brand transition-colors resize-y leading-relaxed"
          />
        ) : (
          <div
            style={{ minHeight, maxHeight }}
            className="w-full p-3 bg-base border border-surface1 overflow-y-auto"
          >
            <MarkdownPreview content={value} emptyPlaceholder="No content to preview" />
          </div>
        )}
      </div>

      {/* Optional Action Bar */}
      {showActions && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-surface1 bg-base/50">
          <span className="text-[10px] text-subtext0 font-mono">
            Tip: Press <kbd className="px-1 py-0.5 bg-surface0 border border-surface1">Ctrl</kbd> + <kbd className="px-1 py-0.5 bg-surface0 border border-surface1">Enter</kbd> to submit
          </span>

          <div className="flex items-center gap-2">
            {extraActions}
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={isSubmitting}
                className="px-3 py-1 bg-surface0 hover:bg-surface1 text-subtext0 hover:text-text text-xs border border-surface1 transition-colors cursor-pointer"
              >
                {cancelLabel}
              </button>
            )}
            {onSubmit && (
              <button
                type="button"
                onClick={onSubmit}
                disabled={isSubmitting || !value.trim()}
                className="px-4 py-1 bg-brand hover:bg-brand/90 text-[#11111b] font-semibold text-xs border border-brand transition-colors cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
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
