import React, { useMemo, useState } from 'react';
import { useTranslation as useUiTextTranslation } from 'react-i18next';
import { Bot } from '../../../../common/components/icons/Bot';
import { Edit2 } from '../../../../common/components/icons/Edit2';
import { GitCommit } from '../../../../common/components/icons/GitCommit';
import { MessageSquare } from '../../../../common/components/icons/MessageSquare';
import { Plus } from '../../../../common/components/icons/Plus';
import { SortAscending } from '../../../../common/components/icons/SortAscending';
import { SortDescending } from '../../../../common/components/icons/SortDescending';
import { Tag } from '../../../../common/components/icons/Tag';
import { User } from '../../../../common/components/icons/User';
import { formatRelativeTime } from '../../../../common/utils/dateTime';
import { useDateTimeLanguage } from '../../../i18n/hooks/useDateTimeLanguage';
import { getAuthorHandle } from '../../utils/discussionAuthorUtils';
import { computeTitleDiff } from '../../utils/virtualMrTitleDiff';
import { DiscussionThread } from '../DiscussionThread';
import type { ActivityFilter } from './types/ActivityFilter';
import type { VirtualMrTimelineEvent } from './types/VirtualMrTimelineEvent';
import type { VirtualMrActivityTimelineProps } from './VirtualMrActivityTimelineProps';

export const VirtualMrActivityTimeline: React.FC<VirtualMrActivityTimelineProps> = ({ session }) => {
  const { t: translateUiText } = useUiTextTranslation();
  const uiLanguage = useDateTimeLanguage();
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const events = useMemo(() => {
    const list: VirtualMrTimelineEvent[] = [];

    // 1. Created event
    list.push({
      id: `created-${session.id}`,
      type: 'created',
      author: session.assignee.name,
      timestamp: session.createdAt,
      render: () => (
        <div className="flex items-center gap-1.5 text-xs text-subtext0 flex-wrap">
          <span className="font-semibold text-text">{session.assignee.name}</span>
          <span>{translateUiText('virtualMr.activity.created')}</span>
          <span className="text-subtext1">({session.compareBranch} → {session.baseBranch})</span>
          <span>·</span>
          <span className="text-subtext0">{formatRelativeTime(session.createdAt)}</span>
        </div>
      ),
    });

    // 2. Labels added
    if (session.labels.length > 0) {
      list.push({
        id: `labels-${session.id}`,
        type: 'label',
        author: session.assignee.name,
        timestamp: session.createdAt,
        render: () => (
          <div className="flex items-center gap-1.5 text-xs text-subtext0 flex-wrap">
            <span className="font-semibold text-text">{session.assignee.name}</span>
            <span>{translateUiText('virtualMr.activity.added')}</span>
            <div className="flex items-center gap-1 flex-wrap">
              {session.labels.map((lbl) => (
                <span
                  key={lbl.id}
                  className="px-2 py-0.5 rounded-sm text-[10px] font-medium text-white shadow-2xs"
                  style={{ backgroundColor: lbl.color }}
                >
                  {lbl.name}
                </span>
              ))}
            </div>
            <span>{translateUiText('virtualMr.activity.labels')}</span>
            <span>·</span>
            <span className="text-subtext0">{formatRelativeTime(session.createdAt)}</span>
          </div>
        ),
      });
    }

    // 3. Assignee
    list.push({
      id: `assignee-${session.id}`,
      type: 'assignee',
      author: session.assignee.name,
      timestamp: session.createdAt,
      render: () => (
        <div className="flex items-center gap-1.5 text-xs text-subtext0 flex-wrap">
          <span className="font-semibold text-text">{session.assignee.name}</span>
          <span>{translateUiText('virtualMr.activity.assignedTo')}</span>
          <span className="text-primary font-medium">
            {getAuthorHandle(session.assignee.name, session.assignee.email)}
          </span>
          <span>·</span>
          <span className="text-subtext0">{formatRelativeTime(session.createdAt)}</span>
        </div>
      ),
    });

    // 4. Reviewers requested
    session.reviewers.forEach((rev) => {
      list.push({
        id: `rev-${rev.agentId}`,
        type: 'reviewer',
        author: session.assignee.name,
        timestamp: session.createdAt,
        render: () => (
          <div className="flex items-center gap-1.5 text-xs text-subtext0 flex-wrap">
            <span className="font-semibold text-text">{session.assignee.name}</span>
            <span>{translateUiText('virtualMr.activity.requestedReviewFrom')}</span>
            <span className="text-primary font-medium">@{rev.agentName}</span>
            <span>·</span>
            <span className="text-subtext0">{formatRelativeTime(session.createdAt)}</span>
          </div>
        ),
      });
    });

    // 5. Commits
    session.commits.forEach((c) => {
      list.push({
        id: `commit-${c.hash}`,
        type: 'commit',
        author: c.authorName,
        timestamp: c.authoredDate,
        render: () => (
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-1.5 text-subtext0 flex-wrap">
              <span className="font-semibold text-text">{c.authorName}</span>
              <span>{translateUiText('virtualMr.activity.commitAdded')}</span>
              <span>·</span>
              <span className="text-subtext0">{formatRelativeTime(c.authoredDate)}</span>
            </div>
            <div className="flex items-center gap-2 ps-2 border-s border-surface2">
              <span className="font-mono text-[11px] text-primary px-1.5 py-0.5 rounded-sm bg-surface0 shrink-0">
                {c.shortHash}
              </span>
              <span className="font-medium text-text text-xs truncate">{c.subject}</span>
            </div>
          </div>
        ),
      });
    });

    // 6. Title changes (inline GitHub / GitLab diff)
    (session.titleHistory || []).forEach((change) => {
      list.push({
        id: change.id,
        type: 'title',
        author: change.authorName,
        timestamp: change.changedAt,
        render: () => {
          const diff = computeTitleDiff(change.oldTitle, change.newTitle);
          return (
            <div className="text-xs text-subtext0 leading-relaxed break-words">
              <span className="font-semibold text-text me-1.5">{change.authorName}</span>
              <span className="me-1.5">{translateUiText('virtualMr.activity.changedTitleFrom')}</span>
              <span className="text-text me-1.5">
                {diff.prefix}
                {diff.oldDiff ? (
                  <span className="bg-red-600 text-white px-1.5 py-0.5 rounded-sm">
                    {diff.oldDiff}
                  </span>
                ) : null}
                {diff.suffix}
              </span>
              <span className="me-1.5">{translateUiText('virtualMr.activity.to')}</span>
              <span className="text-text me-1.5">
                {diff.prefix}
                {diff.newDiff ? (
                  <span className="bg-emerald-600 text-white px-1.5 py-0.5 rounded-sm">
                    {diff.newDiff}
                  </span>
                ) : null}
                {diff.suffix}
              </span>
              <span className="text-subtext0">{formatRelativeTime(change.changedAt)}</span>
            </div>
          );
        },
      });
    });

    // 7. Description updated
    if (
      session.description &&
      session.descriptionUpdatedAt &&
      session.descriptionUpdatedAt !== session.createdAt
    ) {
      list.push({
        id: `desc-${session.id}-${session.descriptionUpdatedAt}`,
        type: 'description',
        author: session.assignee.name,
        timestamp: session.descriptionUpdatedAt,
        render: () => (
          <div className="flex items-center gap-1.5 text-xs text-subtext0 flex-wrap">
            <span className="font-semibold text-text">{session.assignee.name}</span>
            <span>{translateUiText('virtualMr.activity.changedDescription')}</span>
            <span>·</span>
            <span className="text-subtext0">
              {formatRelativeTime(session.descriptionUpdatedAt || session.createdAt)}
            </span>
          </div>
        ),
      });
    }

    // 7. Discussions
    session.discussions.forEach((disc) => {
      const author = disc.rootComment?.authorName || session.assignee.name;
      list.push({
        id: `disc-${disc.id}`,
        type: 'discussion',
        author,
        timestamp: disc.createdAt,
        discussion: disc,
        render: () => (
          <div className="w-full pt-1">
            <DiscussionThread session={session} discussion={disc} />
          </div>
        ),
      });
    });

    // Sort items
    list.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime() || 0;
      const timeB = new Date(b.timestamp).getTime() || 0;
      return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
    });

    return list;
  }, [session, sortOrder, uiLanguage, translateUiText]);

  const filteredEvents = useMemo(() => {
    if (filter === 'comments') {
      return events.filter((e) => e.type === 'discussion');
    }
    if (filter === 'history') {
      return events.filter((e) => e.type !== 'discussion');
    }
    return events;
  }, [events, filter]);

  const getEventIcon = (type: VirtualMrTimelineEvent['type']) => {
    switch (type) {
      case 'created':
        return <Plus className="w-3 h-3 text-green" />;
      case 'label':
        return <Tag className="w-3 h-3 text-primary" />;
      case 'assignee':
        return <User className="w-3 h-3 text-accent" />;
      case 'reviewer':
        return <Bot className="w-3 h-3 text-purple-400" />;
      case 'commit':
        return <GitCommit className="w-3 h-3 text-blue" />;
      case 'title':
      case 'description':
        return <Edit2 className="w-3 h-3 text-subtext0" />;
      case 'discussion':
        return <MessageSquare className="w-3 h-3 text-yellow" />;
    }
  };

  return (
    <div className="space-y-4" aria-label={translateUiText('virtualMr.activity.timeline')}>
      {/* Activity Filter & Sort Header Bar */}
      <div className="flex items-center justify-between pb-2 border-b border-surface0/60 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <h3 className="font-bold text-sm text-text">{translateUiText('virtualMr.activity.title')}</h3>
          <span className="text-[11px] font-mono text-subtext0">
            {translateUiText('virtualMr.activity.entriesCount', { count: filteredEvents.length })}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Filter Pills */}
          <div className="flex items-center p-0.5 rounded-sm bg-crust border border-surface0/70 text-xs">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-2.5 py-1 rounded-sm transition-colors cursor-pointer ${
                filter === 'all'
                  ? 'bg-surface2 text-text font-medium'
                  : 'text-subtext0 hover:text-text'
              }`}
            >
              {translateUiText('virtualMr.activity.all')}
            </button>
            <button
              type="button"
              onClick={() => setFilter('comments')}
              className={`px-2.5 py-1 rounded-sm transition-colors cursor-pointer ${
                filter === 'comments'
                  ? 'bg-surface2 text-text font-medium'
                  : 'text-subtext0 hover:text-text'
              }`}
            >
              {translateUiText('virtualMr.activity.comments', { count: session.discussions.length })}
            </button>
            <button
              type="button"
              onClick={() => setFilter('history')}
              className={`px-2.5 py-1 rounded-sm transition-colors cursor-pointer ${
                filter === 'history'
                  ? 'bg-surface2 text-text font-medium'
                  : 'text-subtext0 hover:text-text'
              }`}
            >
              {translateUiText('virtualMr.activity.history')}
            </button>
          </div>

          {/* Sort Order Toggle */}
          <button
            type="button"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            title={translateUiText(sortOrder === 'asc' ? 'virtualMr.activity.oldestFirstTitle' : 'virtualMr.activity.newestFirstTitle')}
            className="p-1.5 rounded-sm bg-surface0 hover:bg-surface1 text-subtext1 hover:text-text cursor-pointer transition-colors border border-surface1 flex items-center gap-1 text-xs"
          >
            {sortOrder === 'asc' ? (
              <SortAscending className="w-3.5 h-3.5" />
            ) : (
              <SortDescending className="w-3.5 h-3.5" />
            )}
            <span className="text-[11px] font-medium">{translateUiText(sortOrder === 'asc' ? 'virtualMr.activity.oldest' : 'virtualMr.activity.newest')}</span>
          </button>
        </div>
      </div>

      {/* Vertical Timeline Feed */}
      {filteredEvents.length === 0 ? (
        <div className="p-8 text-center text-subtext0 text-xs bg-mantle border border-surface0/60 rounded-sm">
          {translateUiText('virtualMr.activity.noMatchingActivity')}
        </div>
      ) : (
        <div className="relative ps-6 ms-3 border-s-2 border-surface1/70 space-y-4">
          {filteredEvents.map((evt) => (
            <div key={evt.id} className="relative group">
              {/* Timeline Bullet Node */}
              <div className="absolute -start-[35px] top-1 w-5 h-5 rounded-full bg-base border-2 border-surface1 flex items-center justify-center shadow-xs">
                {getEventIcon(evt.type)}
              </div>

              {/* Event Content */}
              <div className="w-full min-w-0">
                {evt.render()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

