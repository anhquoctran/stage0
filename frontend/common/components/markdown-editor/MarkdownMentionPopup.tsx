import type { MarkdownMentionPopupProps } from './MarkdownMentionPopupProps';
import { useTranslation } from 'react-i18next';

export function MarkdownMentionPopup({
  mentionListId,
  suggestions,
  selectedMentionIndex,
  applyMention,
  mentionOptions,
}: MarkdownMentionPopupProps) {
  const { t } = useTranslation();
  return (
    <div
      id={mentionListId}
      role="listbox"
      aria-label={t('common.markdown.mentionParticipant')}
      className="mt-1 max-h-40 overflow-y-auto border border-surface1 bg-mantle shadow-lg rounded-sm"
    >
      {suggestions.map((option, index) => (
        <button
          key={`${option.kind}:${option.id}`}
          type="button"
          role="option"
          id={`${mentionListId}-${index}`}
          title={option.id}
          aria-selected={selectedMentionIndex === index}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => applyMention(option)}
          className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-start text-xs rounded-sm ${selectedMentionIndex === index ? 'bg-surface1 text-text' : 'text-subtext1 hover:bg-surface0'}`}
        >
          <span className="min-w-0 truncate font-medium">
            @{option.label}
            {mentionOptions.some(
              (other) =>
                other.id !== option.id && other.kind === option.kind && other.label === option.label
            ) && (
              <span className="ms-2 font-mono text-[10px] font-normal text-subtext0">
                {option.id}
              </span>
            )}
          </span>
          <span className="shrink-0 text-[10px] text-subtext0">
            {option.kind === 'reviewer' ? t('common.markdown.aiReviewer') : t('common.markdown.assignee')}
          </span>
        </button>
      ))}
    </div>
  );
}
