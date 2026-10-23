import React from 'react';
import type { VirtualMrSession } from '../../types/VirtualMrSession';

export const VirtualMrMergeDetails: React.FC<{ session: VirtualMrSession }> = ({ session }) => {
  const commitCount = session.commits.length;

  return (
    <div className="p-4 rounded-sm bg-mantle border border-surface0 space-y-2 text-xs">
      <span className="font-semibold text-text">Merge details</span>
      <ul className="list-disc list-inside text-subtext0 space-y-1 text-[11px]">
        <li>
          <span className="font-semibold text-text">{commitCount}</span> commit{commitCount === 1 ? '' : 's'}{' '}
          will be added to{' '}
          <span className="font-mono text-primary font-medium">{session.baseBranch}</span> from{' '}
          <span className="font-mono text-primary font-medium">{session.compareBranch}</span>.
        </li>
        <li>
          Comparison ref: <span className="font-mono text-text">{session.compareBranch}</span> →{' '}
          <span className="font-mono text-text">{session.baseBranch}</span>
        </li>
      </ul>
    </div>
  );
};

