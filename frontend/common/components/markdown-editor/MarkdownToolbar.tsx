import { formatShortcutText } from '../../utils/shortcuts';
import { Bold } from '../icons/Bold';
import { CheckSquare } from '../icons/CheckSquare';
import { Code } from '../icons/Code';
import { Eye } from '../icons/Eye';
import { Heading } from '../icons/Heading';
import { Italic } from '../icons/Italic';
import { Link } from '../icons/Link';
import { List } from '../icons/List';
import { ListOrdered } from '../icons/ListOrdered';
import { PenLine } from '../icons/PenLine';
import { Quote } from '../icons/Quote';
import { SquareCode } from '../icons/SquareCode';
import type { MarkdownToolbarProps } from './MarkdownToolbarProps';

export function MarkdownToolbar({
  setActiveTab,
  activeTab,
  insertMarkdown,
  disabled,
  fileInputRef,
  handleImageFiles,
  isSubmitting,
  isAttaching,
  activeFormats,
}: MarkdownToolbarProps) {
  const getButtonClass = (isActive = false, extra = '') =>
    `p-1 transition-colors cursor-pointer disabled:opacity-40 rounded-sm ${
      isActive
        ? 'bg-surface2 text-accent font-semibold shadow-xs'
        : 'text-subtext0 hover:text-text hover:bg-surface1'
    } ${extra}`.trim();

  return (
    <div className="flex items-center justify-between border-b border-surface1 bg-surface0/60 px-2 py-1 gap-1 flex-wrap select-none rounded-sm">
      {/* Write / Preview Tab Switcher */}
      <div className="flex items-center gap-1 pe-1 border-e border-surface1 rounded-sm">
        <button
          type="button"
          onClick={() => setActiveTab('write')}
          className={`flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium cursor-pointer transition-colors rounded-sm ${
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
          className={`flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium cursor-pointer transition-colors rounded-sm ${
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

      {/* Toolbar (Only available in Write tab) matching GitLab formatting */}
      {activeTab === 'write' ? (
        <div className="flex items-center gap-0.5 flex-wrap">
          {/* Insert suggestion */}
          <button
            type="button"
            onClick={() => insertMarkdown('```suggestion\n', '\n```', '// proposed change')}
            disabled={disabled}
            aria-pressed={Boolean(activeFormats?.suggestion)}
            className={getButtonClass(Boolean(activeFormats?.suggestion))}
            title="Insert suggestion"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="9" y1="13" x2="15" y2="13" />
              <line x1="12" y1="10" x2="12" y2="16" />
            </svg>
          </button>

          <span className="w-px h-3 bg-surface1 mx-0.5" />

          {/* Bold */}
          <button
            type="button"
            onClick={() => insertMarkdown('**', '**', 'bold text')}
            disabled={disabled}
            aria-pressed={Boolean(activeFormats?.bold)}
            className={getButtonClass(Boolean(activeFormats?.bold))}
            title={formatShortcutText('Bold (Ctrl+B)')}
          >
            <Bold className="w-3.5 h-3.5" />
          </button>

          {/* Italic */}
          <button
            type="button"
            onClick={() => insertMarkdown('*', '*', 'italic text')}
            disabled={disabled}
            aria-pressed={Boolean(activeFormats?.italic)}
            className={getButtonClass(Boolean(activeFormats?.italic))}
            title={formatShortcutText('Italic (Ctrl+I)')}
          >
            <Italic className="w-3.5 h-3.5" />
          </button>

          {/* Strikethrough */}
          <button
            type="button"
            onClick={() => insertMarkdown('~~', '~~', 'strikethrough text')}
            disabled={disabled}
            aria-pressed={Boolean(activeFormats?.strike)}
            className={getButtonClass(Boolean(activeFormats?.strike), 'font-bold text-xs w-5 text-center leading-none')}
            title="Strikethrough"
          >
            <s>S</s>
          </button>

          <span className="w-px h-3 bg-surface1 mx-0.5" />

          {/* Heading */}
          <button
            type="button"
            onClick={() => insertMarkdown('### ', '', 'Heading')}
            disabled={disabled}
            aria-pressed={Boolean(activeFormats?.heading)}
            className={getButtonClass(Boolean(activeFormats?.heading))}
            title="Heading"
          >
            <Heading className="w-3.5 h-3.5" />
          </button>

          {/* Inline code */}
          <button
            type="button"
            onClick={() => insertMarkdown('`', '`', 'code')}
            disabled={disabled}
            aria-pressed={Boolean(activeFormats?.code)}
            className={getButtonClass(Boolean(activeFormats?.code))}
            title="Inline code"
          >
            <Code className="w-3.5 h-3.5" />
          </button>

          {/* Link */}
          <button
            type="button"
            onClick={() => insertMarkdown('[', '](https://example.com)', 'link text')}
            disabled={disabled}
            aria-pressed={Boolean(activeFormats?.link)}
            className={getButtonClass(Boolean(activeFormats?.link))}
            title={formatShortcutText('Insert link (Ctrl+K)')}
          >
            <Link className="w-3.5 h-3.5" />
          </button>

          {/* Bullet List */}
          <button
            type="button"
            onClick={() => insertMarkdown('- ', '', 'List item')}
            disabled={disabled}
            aria-pressed={Boolean(activeFormats?.bulletList)}
            className={getButtonClass(Boolean(activeFormats?.bulletList))}
            title="Bullet list"
          >
            <List className="w-3.5 h-3.5" />
          </button>

          {/* Numbered List */}
          <button
            type="button"
            onClick={() => insertMarkdown('1. ', '', 'Numbered item')}
            disabled={disabled}
            aria-pressed={Boolean(activeFormats?.numberList)}
            className={getButtonClass(Boolean(activeFormats?.numberList))}
            title="Numbered list"
          >
            <ListOrdered className="w-3.5 h-3.5" />
          </button>

          {/* Task List */}
          <button
            type="button"
            onClick={() => insertMarkdown('- [ ] ', '', 'Task item')}
            disabled={disabled}
            aria-pressed={Boolean(activeFormats?.taskList)}
            className={getButtonClass(Boolean(activeFormats?.taskList))}
            title="Task list"
          >
            <CheckSquare className="w-3.5 h-3.5" />
          </button>

          {/* Quote */}
          <button
            type="button"
            onClick={() => insertMarkdown('> ', '', 'Quote')}
            disabled={disabled}
            aria-pressed={Boolean(activeFormats?.quote)}
            className={getButtonClass(Boolean(activeFormats?.quote))}
            title="Quote"
          >
            <Quote className="h-3.5 w-3.5" />
          </button>

          {/* Table */}
          <button
            type="button"
            onClick={() =>
              insertMarkdown(
                '| Header 1 | Header 2 |\n| --- | --- |\n| Cell 1 | Cell 2 |\n',
                '',
                ''
              )
            }
            disabled={disabled}
            aria-pressed={Boolean(activeFormats?.table)}
            className={getButtonClass(Boolean(activeFormats?.table))}
            title="Insert table"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="18" height="18" x="3" y="3" />
              <path d="M3 9h18" />
              <path d="M3 15h18" />
              <path d="M9 3v18" />
              <path d="M15 3v18" />
            </svg>
          </button>

          {/* Attach image */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/gif,image/webp,image/svg+xml"
            multiple
            className="hidden rounded-sm"
            data-testid="image-attachment-input"
            onChange={(e) => {
              if (e.target.files) {
                handleImageFiles(e.target.files);
                e.target.value = '';
              }
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isSubmitting || isAttaching}
            className="p-1 text-subtext0 hover:text-text hover:bg-surface1 transition-colors cursor-pointer disabled:opacity-40 rounded-sm"
            title="Attach images (PNG, JPG, GIF, WebP, SVG)"
            aria-label="Attach images"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>

          {/* Code block */}
          <button
            type="button"
            onClick={() => insertMarkdown('```\n', '\n```', 'code block')}
            disabled={disabled}
            aria-pressed={Boolean(activeFormats?.codeBlock)}
            className={getButtonClass(Boolean(activeFormats?.codeBlock))}
            title="Code block"
          >
            <SquareCode className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <span className="text-[11px] text-subtext0 font-mono italic">Preview Markdown</span>
      )}
    </div>
  );
}
