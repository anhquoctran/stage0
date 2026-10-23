import React from 'react';
import { GitCommit } from '../../../../common/components/icons/GitCommit';
import { formatDateTime } from '../../../../common/utils/dateTime';
import type { VirtualMrCommitsTabProps } from './VirtualMrCommitsTabProps';

export const VirtualMrCommitsTab: React.FC<VirtualMrCommitsTabProps> = ({ session }) => {
  return (
    <div className="flex-1 h-full overflow-y-auto p-6 bg-crust/30">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between border-b border-surface0 pb-2">
          <h3 className="font-semibold text-xs text-text flex items-center gap-2">
            <GitCommit className="w-4 h-4 text-primary" />
            <span>Commits ({session.commits.length})</span>
          </h3>
          <span className="text-[11px] font-mono text-subtext0">
            {session.compareBranch} → {session.baseBranch}
          </span>
        </div>

        {session.commits.length === 0 ? (
          <div className="p-8 rounded-sm bg-mantle border border-surface0 text-center space-y-2">
            <GitCommit className="w-8 h-8 text-subtext0 mx-auto" />
            <p className="text-xs text-subtext0">
              No commits unique to <span className="font-mono text-text">{session.compareBranch}</span> relative to{' '}
              <span className="font-mono text-text">{session.baseBranch}</span>.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {session.commits.map((c) => (
              <div
                key={c.hash}
                className="p-3.5 rounded-sm bg-mantle border border-surface0 hover:border-surface1 transition-colors flex items-center justify-between gap-4"
              >
                <div className="space-y-1 min-w-0">
                  <div className="font-medium text-xs text-text truncate">{c.subject}</div>
                  <div className="flex items-center gap-3 text-[11px] text-subtext0 font-mono">
                    <span className="text-primary font-medium">{c.authorName}</span>
                    <span>{formatDateTime(c.authoredDate)}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="px-2 py-0.5 rounded-sm bg-surface0 font-mono text-[11px] text-subtext0">
                    {c.shortHash}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
