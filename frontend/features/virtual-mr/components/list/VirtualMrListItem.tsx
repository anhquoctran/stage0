import { CheckCircle2 } from '../../../../common/components/icons/CheckCircle2';
import { MessageSquare } from '../../../../common/components/icons/MessageSquare';
import { formatDateTime } from '../../../../common/utils/dateTime';
import { useDateTimeLanguage } from '../../../i18n/hooks/useDateTimeLanguage';
import { useTranslation as useUiTextTranslation } from 'react-i18next';
import { GitLabAvatar } from '../GitLabAvatar';
import type { VirtualMrListItemProps } from './VirtualMrListItemProps';

export function VirtualMrListItem({
  session,
  handleSelect,
  statusLabel,
  sequenceNumber,
  createdLabel,
  globalReviewers,
  BOT_DEFAULT_EMOJIS,
  updatedLabel,
}: VirtualMrListItemProps) {
  const { t: translateUiText } = useUiTextTranslation();
  useDateTimeLanguage();
  return (
    <button
      key={session.id}
      type="button"
      onClick={() => handleSelect(session.id)}
      className="group flex w-full items-center justify-between gap-4 px-5 py-3 text-start hover:bg-surface0/60 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand cursor-pointer rounded-sm"
    >
      <div className="min-w-0 flex-1 space-y-1.5">
        {/* Top line: Title (bold) + Status Badge + Assigned Labels */}
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className="truncate text-sm font-bold text-text group-hover:text-brand"
            title={session.title}
          >
            {session.title}
          </span>
          <span
            className={`inline-flex shrink-0 items-center gap-1 border px-1.5 py-0.5 text-[10px] font-semibold select-none ${
              session.status === 'closed'
                ? 'border-surface1 bg-surface0 text-subtext1'
                : session.status === 'resolved'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : 'border-brand/30 bg-brand/10 text-brand'
            }`}
          >
            {session.status === 'resolved' ? <CheckCircle2 className="h-3 w-3" /> : null}
            {statusLabel}
          </span>

          {/* Assigned labels */}
          {session.labels.map((label) => (
            <span
              key={label.id}
              className="border border-surface1 bg-surface0/60 px-1.5 py-0.5 text-[10px] font-medium text-subtext0 select-none"
            >
              {label.name}
            </span>
          ))}
        </div>

        {/* Bottom line: Sequence ID, Created Time, Creator + Avatar, Source Branch -> Target Branch */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-subtext0">
          {/* Friendly MR ID (sequence) */}
          <span className="font-mono font-semibold text-subtext1">!{sequenceNumber}</span>

          <span className="select-none text-surface2">·</span>

          {/* Friendly created timestamp & Creator + avatar */}
          <div className="flex items-center gap-1.5">
            <span>{translateUiText('virtualMr.listItem.createdAt', { time: createdLabel })}</span>
            <span>{translateUiText('virtualMr.listItem.by')}</span>
            <GitLabAvatar
              name={session.assignee.name}
              email={session.assignee.email}
              avatarUrl={session.assignee.avatarUrl}
              size="xs"
            />
            <span className="font-medium text-subtext1">{session.assignee.name}</span>
          </div>

          <span className="select-none text-surface2">·</span>

          {/* Source branch -> target branch */}
          <div className="flex items-center gap-1 font-mono text-[11px] text-subtext1">
            <span className="max-w-[220px] truncate" title={session.compareBranch}>
              {session.compareBranch}
            </span>
            <span className="text-subtext0">→</span>
            <span className="max-w-[220px] truncate" title={session.baseBranch}>
              {session.baseBranch}
            </span>
          </div>
        </div>
      </div>

      {/* Right side: Reviewer bot icons, Assignee icon, Discussions count, Friendly updated timestamp */}
      <div className="flex shrink-0 items-center gap-4 text-xs text-subtext0">
        {/* Reviewer bot icons */}
        {session.reviewers.length > 0 && (
          <div
            className="flex items-center -space-x-1 rtl:space-x-reverse"
            title={translateUiText('virtualMr.listItem.reviewerBotCount', { count: session.reviewers.length })}
          >
            {session.reviewers.map((rev) => {
              const bot = globalReviewers.find((b) => b.id === rev.agentId);
              const emoji = bot?.avatarEmoji || BOT_DEFAULT_EMOJIS[rev.agentId] || '🤖';
              return (
                <span
                  key={rev.agentId}
                  className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-300 ring-2 ring-mantle flex items-center justify-center text-[10px] shrink-0"
                  title={translateUiText('virtualMr.listItem.reviewerTitle', { name: rev.agentName })}
                >
                  {emoji}
                </span>
              );
            })}
          </div>
        )}

        {/* Assignee icon */}
        <div title={translateUiText('virtualMr.listItem.assigneeTitle', { name: session.assignee.name })}>
          <GitLabAvatar
            name={session.assignee.name}
            email={session.assignee.email}
            avatarUrl={session.assignee.avatarUrl}
            size="sm"
          />
        </div>

        {/* Discussions count */}
        {session.discussions.length > 0 && (
          <span
            className="inline-flex items-center gap-1 font-mono text-[11px]"
            title={translateUiText('virtualMr.listItem.discussionCount', { count: session.discussions.length })}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            {session.discussions.length}
          </span>
        )}

        {/* Friendly updated timestamp */}
        <time
          dateTime={session.updatedAt}
          title={formatDateTime(session.updatedAt)}
          className="text-end text-[11px] text-subtext0 min-w-[70px]"
        >
          {translateUiText('virtualMr.listItem.updatedAt', { time: updatedLabel })}
        </time>
      </div>
    </button>
  );
}
