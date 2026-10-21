import React from 'react';
import type { VirtualMrSession } from '../types/VirtualMrSession';
import { DiscussionThread } from './DiscussionThread';
import { isResolvableDiscussion } from '../utils/discussionResolvable';

export const MrDiscussionBoard: React.FC<{ session: VirtualMrSession }> = ({ session }) => (
  <div className="space-y-4" aria-label="MR discussion board">
    <div className="flex items-center justify-between pb-2 border-b border-surface0">
      <h3 className="text-xs font-semibold text-text">Discussions ({session.discussions.length})</h3>
      <span className="text-[11px] text-subtext0">
        {session.discussions.filter((d) => isResolvableDiscussion(d) && !d.isResolved).length} unresolved
      </span>
    </div>
    {session.discussions.length === 0 ? (
      <div className="p-8 text-center text-subtext0 text-xs bg-surface0/20 border border-surface0/60">
        No discussions yet. Click on any line number in the diff to start a discussion.
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
