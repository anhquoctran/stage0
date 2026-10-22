import { formatDateTime } from '@/common/utils/dateTime';
import type { VirtualMrCommitsTabProps } from './VirtualMrCommitsTabProps';

export function VirtualMrCommitsTab({ session }: VirtualMrCommitsTabProps) {
  return (
    <div className="p-4 bg-crust/50 border-b border-surface0 max-h-72 overflow-y-auto space-y-2">
      {session.commits.length === 0 ? (
        <div className="p-6 text-center text-subtext0 text-xs">
          No commits unique to {session.compareBranch} relative to {session.baseBranch}.
        </div>
      ) : (
        session.commits.map((c) => (
          <div
            key={c.hash}
            className="p-3  bg-mantle border border-surface0 flex items-center justify-between gap-4"
          >
            <div className="space-y-1 min-w-0">
              <div className="font-medium text-xs text-text truncate">{c.subject}</div>
              <div className="flex items-center gap-3 text-[11px] text-subtext0 font-mono">
                <span className="text-accent">{c.authorName}</span>
                <span>{formatDateTime(c.authoredDate)}</span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="px-2 py-0.5  bg-surface0 font-mono text-[11px] text-subtext0">
                {c.shortHash}
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
