import React from 'react';
import type { VirtualMrSession } from '../types/VirtualMrSession';
import { DiscussionThread } from './DiscussionThread';

export const MrDiscussionBoard: React.FC<{ session: VirtualMrSession }> = ({ session }) => (
  <div className="space-y-3" aria-label="MR discussion board">
    <h3 className="text-xs font-semibold text-text">Discussions ({session.discussions.length})</h3>
    {session.discussions.map((discussion) => (
      <div key={discussion.id} className="border border-surface0 bg-mantle p-3">
        <DiscussionThread session={session} discussion={discussion} />
      </div>
    ))}
  </div>
);
