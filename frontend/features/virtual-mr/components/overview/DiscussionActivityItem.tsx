import { useTranslation } from 'react-i18next';
import { formatRelativeTime, formatTime } from '../../../../common/utils/dateTime';
import type { VirtualMrDiscussionActivity } from '../../types/VirtualMrDiscussionActivity';

export function DiscussionActivityItem({ activity }: { activity: VirtualMrDiscussionActivity }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs text-subtext0" data-discussion-activity-id={activity.id}>
      <span className="font-semibold text-text" title={activity.actorId}>{activity.actorName}</span>
      <span>{t(activity.action === 'resolved' ? 'virtualMr.activity.resolvedBotDiscussion' : 'virtualMr.activity.reopenedBotDiscussion')}</span>
      <span className="font-semibold text-text">{activity.reviewerName}</span>
      {activity.filePath && <span className="rounded-sm bg-surface0 px-1.5 py-0.5 font-mono text-[10px] break-all" title={activity.discussionId}>{activity.filePath}</span>}
      <span aria-hidden="true">·</span>
      <time dateTime={activity.createdAt} title={formatTime(activity.createdAt)}>{formatRelativeTime(activity.createdAt)}</time>
    </div>
  );
}
