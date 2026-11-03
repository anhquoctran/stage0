import { useTranslation } from 'react-i18next';
import { formatRelativeTime, formatTime } from '../../../../common/utils/dateTime';
import type { VirtualMrDeletionActivity } from '../../types/VirtualMrDeletionActivity';

export function DeletionActivityItem({ activity }: { activity: VirtualMrDeletionActivity }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-1.5 text-xs text-subtext0 flex-wrap" data-deletion-activity-id={activity.id}>
      <span className="font-semibold text-text">{activity.actorName}</span>
      <span>{t(activity.targetKind === 'discussion' ? 'virtualMr.activity.deletedDiscussion' : 'virtualMr.activity.deletedReply')}</span>
      <span className="font-mono text-[10px] bg-surface0 px-1.5 py-0.5 rounded-sm" title={activity.commentId}>
        {activity.commentId.slice(0, 13)}
      </span>
      <span aria-hidden="true">·</span>
      <time dateTime={activity.createdAt} title={formatTime(activity.createdAt)}>{formatRelativeTime(activity.createdAt)}</time>
    </div>
  );
}
