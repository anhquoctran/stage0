import { MarkdownPreview } from '../../../../common/components/MarkdownPreview';
import { Quote } from '../../../../common/components/icons/Quote';
import { GitLabAvatar } from '../GitLabAvatar';
import { AiBotBadge } from '../AiBotBadge';
import type { DiscussionReplyCommentProps } from './DiscussionReplyCommentProps';

export function DiscussionReplyComment({
  reply,
  handle,
  relativeTime,
  badges,
  quote,
  isSubmitting,
}: DiscussionReplyCommentProps) {
  return (
    <div key={reply.id} className="group relative flex gap-3 text-xs text-text transition-colors">
      <GitLabAvatar
        name={reply.authorName}
        email={reply.authorId}
        avatarUrl={reply.authorAvatar}
        isAiAgent={reply.authorType === 'ai_agent'}
        size="sm"
      />

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-1.5 leading-tight">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            <span className="font-semibold text-text text-xs hover:underline cursor-pointer">
              {reply.authorName}
            </span>
            {reply.authorType === 'ai_agent' && <AiBotBadge />}
            <span className="text-subtext0 text-xs font-normal">{handle}</span>
            <span className="text-subtext0 select-none">·</span>
            <time dateTime={reply.createdAt} className="text-subtext0 text-xs">
              {relativeTime}
            </time>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="px-1.5 py-0.5 text-[10px] font-medium border border-surface1 bg-surface0/50 text-subtext0 select-none rounded-sm">
              Reply
            </span>

            {badges.map((badge) => (
              <span
                key={badge}
                className="px-1.5 py-0.5 text-[10px] font-semibold border border-surface2 bg-surface1/60 text-subtext1 select-none rounded-sm"
              >
                {badge}
              </span>
            ))}

            <button
              type="button"
              onClick={() => quote(reply)}
              disabled={isSubmitting}
              className="p-1 text-subtext0 hover:text-brand hover:bg-surface0 transition-colors cursor-pointer rounded-sm"
              aria-label={`Quote comment ${reply.id}`}
              title={`Quote comment ${reply.id}`}
            >
              <Quote className="h-3 w-3" />
            </button>
          </div>
        </div>

        <div className="pt-0.5 leading-relaxed text-text select-text">
          <MarkdownPreview content={reply.body} />
        </div>
      </div>
    </div>
  );
}
