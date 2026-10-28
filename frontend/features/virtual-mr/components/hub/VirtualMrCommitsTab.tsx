import React, { useState } from 'react';
import { GitCommit } from '../../../../common/components/icons/GitCommit';
import { formatDateTime } from '../../../../common/utils/dateTime';
import { useDateTimeLanguage } from '../../../i18n/hooks/useDateTimeLanguage';
import type { VirtualMrCommitsTabProps } from './VirtualMrCommitsTabProps';
import { useGitStore } from '../../../git/store/useGitStore';
import { CommitDetailsModal } from '../../../git/components/CommitDetailsModal';

export const VirtualMrCommitsTab: React.FC<VirtualMrCommitsTabProps> = ({ session }) => {
  useDateTimeLanguage();
  const currentRepo = useGitStore(state => state.currentRepo);
  const [selected, setSelected] = useState<{ sessionId: string; hash: string } | null>(null);
  const repoPath = currentRepo?.id === session.repoId ? currentRepo.local_path : null;
  return (
    <div className="flex-1 h-full overflow-y-auto px-6 py-6 bg-crust/30 w-full">
      <div className="w-full space-y-4">
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
              <button
                key={c.hash}
                type="button"
                onClick={() => setSelected({ sessionId: session.id, hash: c.hash })}
                disabled={!repoPath}
                aria-label={`View commit ${c.shortHash}: ${c.subject}`}
                className="w-full p-3.5 text-start rounded-sm bg-mantle border border-surface0 hover:border-surface1 transition-colors flex items-center justify-between gap-4 cursor-pointer focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-50 disabled:cursor-default"
              >
                <span className="space-y-1 min-w-0">
                  <span className="block font-medium text-xs text-text truncate">{c.subject}</span>
                  <span className="flex items-center gap-3 text-[11px] text-subtext0 font-mono">
                    <span className="text-primary font-medium">{c.authorName}</span>
                    <span>{formatDateTime(c.authoredDate)}</span>
                  </span>
                </span>
                <span className="text-end shrink-0">
                  <span className="px-2 py-0.5 rounded-sm bg-surface0 font-mono text-[11px] text-subtext0">
                    {c.shortHash}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      {repoPath && selected?.sessionId === session.id && <CommitDetailsModal key={`${session.id}:${selected.hash}`}
        repoPath={repoPath} commitHash={selected.hash} onClose={() => setSelected(null)} />}
    </div>
  );
};
