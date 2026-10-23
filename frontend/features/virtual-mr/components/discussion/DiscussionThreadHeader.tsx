import { Quote } from '../../../../common/components/icons/Quote';
import { GitLabAvatar } from '../GitLabAvatar';
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
          <span className="text-subtext0 font-normal">{rootAuthorHandle}</span>
          <span>
            {discussion.filePath ? 'started a thread on the diff' : 'started a discussion'}
          </span>
          <time dateTime={discussion.createdAt || rootComment?.createdAt} className="text-subtext0">
            {threadRelativeTime}
          </time>
        </div>
      </div>

      {/* Right side: Line number badge and Quote Discussion Button */}
      <div className="flex items-center gap-2">
        {discussion.lineNumber && (
          <span className="font-mono text-[10px] text-subtext0 bg-surface0 border border-surface1 px-2 py-0.5">
            Line {discussion.lineNumber}
          </span>
        )}

        <button
          type="button"
          onClick={() => quote()}
          disabled={isSubmitting}
          className="flex shrink-0 items-center gap-1 text-subtext0 hover:text-brand disabled:opacity-50 text-[11px] p-1 hover:bg-surface0 transition-colors cursor-pointer rounded-sm"
          aria-label={`Quote discussion ${discussion.id}`}
        >
          <Quote className="h-3 w-3" />
          <span>Quote discussion</span>
        </button>
      </div>
    </div>
  );
}
