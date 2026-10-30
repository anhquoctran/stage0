import React from 'react';
import { useTranslation } from 'react-i18next';
import type { VirtualMrSession } from '../types/VirtualMrSession';
import { DiscussionThread } from './DiscussionThread';
import { isResolvableDiscussion } from '../utils/discussionResolvable';

export const MrDiscussionBoard: React.FC<{ session: VirtualMrSession }> = ({ session }) => {
  const { t } = useTranslation();
  const unresolvedCount = session.discussions.filter((d) => isResolvableDiscussion(d) && !d.isResolved).length;
  return (
    <div className="space-y-4" aria-label={t('virtualMr.discussionBoard.ariaLabel')}>
      <div className="flex items-center justify-between pb-2 border-b border-surface0">
        <h3 className="text-xs font-semibold text-text">
          {t('virtualMr.discussionBoard.title', { count: session.discussions.length })}
        </h3>
        <span className="text-[11px] text-subtext0">
          {t('virtualMr.discussionBoard.unresolved', { count: unresolvedCount })}
        </span>
      </div>
      {session.discussions.length === 0 ? (
        <div className="p-8 text-center text-subtext0 text-xs bg-surface0/20 border border-surface0/60 rounded-sm">
          {t('virtualMr.discussionBoard.empty')}
        </div>
      ) : (
        <div className="space-y-4">
          {session.discussions.map((discussion) => (
            <DiscussionThread key={discussion.id} session={session} discussion={discussion} />
          ))}
        </div>
      )}
    </div>
  );
};
