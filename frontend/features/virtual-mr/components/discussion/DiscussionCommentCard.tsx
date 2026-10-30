import { useTranslation } from 'react-i18next';
import { MarkdownPreview } from '../../../../common/components/MarkdownPreview';
import { getDiscussionCommentBody } from '../../utils/discussionCommentBody';

import {
  formatGitLabTime,
  getAuthorBadges,
  getAuthorHandle,
} from '../../utils/discussionAuthorUtils';
import { GitLabAvatar } from '../GitLabAvatar';
import { AiBotBadge } from '../AiBotBadge';
import { useDateTimeLanguage } from '../../../i18n/hooks/useDateTimeLanguage';
import type { DiscussionCommentCardProps } from './DiscussionCommentCardProps';

export function DiscussionCommentCard({
  rootComment,
  session,
  isResolvable,
  discussion,
}: DiscussionCommentCardProps) {
  const { t } = useTranslation();
  useDateTimeLanguage();
  return (
    <div className="p-3.5 text-xs text-text transition-colors bg-mantle rounded-sm">
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
              {rootComment.authorType === 'ai_agent' && <AiBotBadge />}
              <span className="text-subtext0 text-xs font-normal">
                {getAuthorHandle(
                  rootComment.authorName,
                  rootComment.authorId || session?.assignee?.email,
                  rootComment.authorType
                )}
              </span>
              <span className="text-subtext0 select-none">·</span>
              <time dateTime={rootComment.createdAt} className="text-subtext0 text-xs">
                {formatGitLabTime(rootComment.createdAt)}
              </time>
            </div>

            {/* Badges */}
            <div className="flex items-center gap-1.5 shrink-0">
              {getAuthorBadges(rootComment.authorName, rootComment.authorType, session).map(
                (badge) => (
                  <span
                    key={badge}
                    className="px-1.5 py-0.5 text-[10px] font-semibold border border-surface2 bg-surface1/60 text-subtext1 select-none rounded-sm"
                  >
                    {badge}
                  </span>
                )
              )}

              {isResolvable && discussion.isResolved && (
                <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 select-none rounded-sm">
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
                  <span>{t('virtualMr.discussion.resolvedBadge')}</span>
                </span>
              )}
            </div>
          </div>

          <div className="pt-0.5 leading-relaxed text-text select-text">
            <MarkdownPreview content={getDiscussionCommentBody(rootComment)} />
          </div>
        </div>
      </div>
    </div>
  );
}
