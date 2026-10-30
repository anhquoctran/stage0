import { Quote } from '../../../../common/components/icons/Quote';
import { GitLabAvatar } from '../GitLabAvatar';
import { AiBotBadge } from '../AiBotBadge';
import { getDiscussionPosition } from '../../utils/discussionCodeContext';
import type { DiscussionThreadHeaderProps } from './DiscussionThreadHeaderProps';

export function DiscussionThreadHeader({
  rootAuthorName,
  rootComment,
  rootAuthorHandle,
  discussion,
  threadRelativeTime,
  quote,
  isSubmitting,
}: DiscussionThreadHeaderProps) {
  const { t: translateUiText } = useUiTextTranslation();
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
      <div className="flex items-center gap-2 min-w-0">
        <GitLabAvatar
          name={rootAuthorName}
          email={rootComment?.authorId}
          avatarUrl={rootComment?.authorAvatar}
          isAiAgent={rootComment?.authorType === 'ai_agent'}
          size="sm"
        />
        <div className="flex items-center gap-1.5 flex-wrap text-subtext0 leading-tight">
          <span className="font-semibold text-text hover:underline cursor-pointer">
            {rootAuthorName}
          </span>
          {rootComment?.authorType === 'ai_agent' && <AiBotBadge />}
          <span className="text-subtext0 font-normal">{rootAuthorHandle}</span>
          <span>
            {translateUiText(discussion.filePath ? 'virtualMr.discussion.startedThreadOnDiff' : 'virtualMr.discussion.startedDiscussion')}
          </span>
          <time dateTime={discussion.createdAt || rootComment?.createdAt} className="text-subtext0">
            {threadRelativeTime}
          </time>
        </div>
      </div>

      {/* Right side: Line number badge and Quote Discussion Button */}
      <div className="flex items-center gap-2">
        {getDiscussionPosition(discussion) && (
          <span className="font-mono text-[11px] text-subtext1 bg-surface0 px-2 py-0.5 rounded-sm">
            {getDiscussionPosition(discussion)?.shortLabel}
          </span>
        )}

        <button
          type="button"
          onClick={() => quote()}
          disabled={isSubmitting}
          className="flex shrink-0 items-center gap-1 text-subtext0 hover:text-brand disabled:opacity-50 text-[11px] p-1 hover:bg-surface0 transition-colors cursor-pointer rounded-sm"
          aria-label={translateUiText('virtualMr.discussion.quoteDiscussionWithId', { id: discussion.id })}
        >
          <Quote className="h-3 w-3" />
          <span>{translateUiText('virtualMr.discussion.quoteDiscussion')}</span>
        </button>
      </div>
    </div>
  );
}
import { useTranslation as useUiTextTranslation } from 'react-i18next';
