import { Sparkles } from '../icons/Sparkles';
import { useTranslation } from 'react-i18next';
import type { MarkdownFooterActionsProps } from './MarkdownFooterActionsProps';

export function MarkdownFooterActions({
  showActions,
  mentionOptions,
  onGenerateDraft,
  disabled,
  isSubmitting,
  extraActions,
  onCancel,
  cancelLabel,
  onSubmit,
  value,
  submitLabel,
}: MarkdownFooterActionsProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between px-3 py-2 border-t border-surface1 bg-base/50 gap-2 select-none rounded-sm">
      <div className="flex items-center gap-2 text-[10px] text-subtext0 font-mono">
        {showActions && (
          <span>
            {mentionOptions.length > 0 && <span>{t('common.markdown.typeToMention')} · </span>}
            {t('common.markdown.tipPress')} <kbd className="px-1 py-0.5 bg-surface0 border border-surface1">
              Ctrl
            </kbd> + <kbd className="px-1 py-0.5 bg-surface0 border border-surface1">Enter</kbd>{' '}
            {t('common.markdown.toSubmit')}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {onGenerateDraft && (
          <button
            type="button"
            onClick={onGenerateDraft}
            disabled={disabled || isSubmitting}
            className="p-1 text-subtext0 hover:text-purple-300 hover:bg-surface1 active:bg-surface2 transition-colors cursor-pointer disabled:opacity-40 rounded-sm"
            title={t('common.markdown.generateDraftTitle')}
            aria-label={t('common.markdown.generateDraftLabel')}
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
            className="px-3 py-1 bg-surface1 hover:bg-surface2 active:bg-surface0 text-white text-xs transition-colors cursor-pointer rounded-sm"
          >
            {cancelLabel}
          </button>
        )}

        {showActions && onSubmit && (
          <button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting || !value.trim()}
            className="px-4 py-1 bg-brand hover:bg-brand/90 text-on-accent font-semibold text-xs transition-colors cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed rounded-sm"
          >
            {isSubmitting ? t('common.markdown.submitting') : submitLabel}
          </button>
        )}
      </div>
    </div>
  );
}
