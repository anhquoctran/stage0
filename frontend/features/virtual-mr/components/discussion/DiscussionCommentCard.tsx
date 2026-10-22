import { MarkdownPreview } from '../../../../common/components/MarkdownPreview';
import { Quote } from '../../../../common/components/icons/Quote';
import {
  formatGitLabTime,
  getAuthorBadges,
  getAuthorHandle,
} from '../../utils/discussionAuthorUtils';
import { GitLabAvatar } from '../GitLabAvatar';
import type { DiscussionCommentCardProps } from './DiscussionCommentCardProps';

export function DiscussionCommentCard({
  rootComment,
  session,
  isResolvable,
  discussion,
  quote,
  isSubmitting,
}: DiscussionCommentCardProps) {
  return (
    <div className="p-3.5 text-xs text-text transition-colors bg-mantle">
      <div className="flex gap-3">
        <GitLabAvatar
          name={rootComment.authorName}
          email={rootComment.authorId}
          avatarUrl={rootComment.authorAvatar}
          isAiAgent={rootComment.authorType === 'ai_agent'}
          size="md"
        />

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-1.5 leading-tight">
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              <span className="font-semibold text-text text-xs hover:underline cursor-pointer">
                {rootComment.authorName}
              </span>
              <span className="text-subtext0 text-xs font-normal">
                {getAuthorHandle(rootComment.authorName, rootComment.authorId)}
              </span>
              <span className="text-subtext0 select-none">·</span>
              <time dateTime={rootComment.createdAt} className="text-subtext0 text-xs">
                {formatGitLabTime(rootComment.createdAt)}
              </time>
            </div>

            {/* Badges & Quote */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Clear Root Discussion Tag */}
              <span className="px-1.5 py-0.5 text-[10px] font-semibold border border-blue/40 bg-blue/10 text-blue select-none">
                Root Discussion
              </span>

              {getAuthorBadges(rootComment.authorName, rootComment.authorType, session).map(
                (badge) => (
                  <span
                    key={badge}
                    className="px-1.5 py-0.5 text-[10px] font-semibold border border-surface2 bg-surface1/60 text-subtext1 select-none"
                  >
                    {badge}
                  </span>
                )
              )}

              {isResolvable && discussion.isResolved && (
                <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 select-none">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Resolved</span>
                </span>
              )}

              <button
                type="button"
                onClick={() => quote(rootComment)}
                disabled={isSubmitting}
                className="p-1 text-subtext0 hover:text-brand hover:bg-surface0 transition-colors cursor-pointer"
                aria-label={`Quote comment ${rootComment.id}`}
                title={`Quote comment ${rootComment.id}`}
              >
                <Quote className="h-3 w-3" />
              </button>
            </div>
          </div>

          <div className="pt-0.5 leading-relaxed text-text select-text">
            <MarkdownPreview content={rootComment.body} />
          </div>
        </div>
      </div>
    </div>
  );
}
