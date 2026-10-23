import { GitPullRequest } from '../../../../common/components/icons/GitPullRequest';
import { Plus } from '../../../../common/components/icons/Plus';
import { X } from '../../../../common/components/icons/X';
import type { VirtualMrListHeaderProps } from './VirtualMrListHeaderProps';

export function VirtualMrListHeader({
  sessions,
  currentRepo,
  setIsMrListOpen,
  openNewMrDraft,
  inline,
}: VirtualMrListHeaderProps) {
  return (
    <header className="flex items-start justify-between gap-4 border-b border-surface0 px-5 py-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-brand">
          <GitPullRequest className="h-4 w-4 shrink-0" />
          <h2 id="virtual-mr-list-title" className="text-base font-semibold text-text">
            Merge requests
          </h2>
          <span className="border border-surface1 bg-surface0 px-1.5 py-0.5 font-mono text-[10px] text-subtext0">
            {sessions.length}
          </span>
        </div>
        <p className="mt-1 truncate text-xs text-subtext0" title={currentRepo.local_path}>
          {currentRepo.name} · {currentRepo.local_path}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setIsMrListOpen(false);
            void openNewMrDraft();
          }}
          className="flex items-center gap-1.5 bg-primary px-2.5 py-1.5 text-xs font-semibold text-on-accent hover:bg-primary/90 cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Create Merge Request</span>
        </button>
        {!inline && (
          <button
            type="button"
            onClick={() => setIsMrListOpen(false)}
            className="shrink-0 p-1 text-subtext0 hover:bg-surface0 hover:text-text cursor-pointer"
            title="Close merge request list"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </header>
  );
}
