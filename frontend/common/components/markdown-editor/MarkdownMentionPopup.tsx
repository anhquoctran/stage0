import type { MarkdownMentionPopupProps } from './MarkdownMentionPopupProps';

export function MarkdownMentionPopup({
  mentionListId,
  suggestions,
  selectedMentionIndex,
  applyMention,
  mentionOptions,
}: MarkdownMentionPopupProps) {
  return (
    <div
      id={mentionListId}
      role="listbox"
      aria-label="Mention a participant"
      className="mt-1 max-h-40 overflow-y-auto border border-surface1 bg-mantle shadow-lg"
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
          className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs ${selectedMentionIndex === index ? 'bg-surface1 text-text' : 'text-subtext1 hover:bg-surface0'}`}
        >
          <span className="min-w-0 truncate font-medium">
            @{option.label}
            {mentionOptions.some(
              (other) =>
                other.id !== option.id && other.kind === option.kind && other.label === option.label
            ) && (
              <span className="ml-2 font-mono text-[10px] font-normal text-subtext0">
                {option.id}
              </span>
            )}
          </span>
          <span className="shrink-0 text-[10px] text-subtext0">
            {option.kind === 'reviewer' ? 'AI reviewer' : 'Assignee'}
          </span>
        </button>
      ))}
    </div>
  );
}
