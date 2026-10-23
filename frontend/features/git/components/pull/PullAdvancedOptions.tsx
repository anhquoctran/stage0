import type { PullAdvancedOptionsProps } from './PullAdvancedOptionsProps';

export function PullAdvancedOptions({
  useRebase,
  setUseRebase,
  setUseFfOnly,
  useAutostash,
  setUseAutostash,
  useFfOnly,
  useNoCommit,
  setUseNoCommit,
}: PullAdvancedOptionsProps) {
  return (
    <div className="space-y-2 pt-2 border-t border-surface0/80">
      <span className="text-[11px] font-bold uppercase tracking-wider text-subtext0 block mb-1">
        Advanced Options
      </span>

      {/* --rebase */}
      <label className="flex items-start gap-2.5 cursor-pointer py-1 group">
        <input
          type="checkbox"
          checked={useRebase}
          onChange={(e) => {
            setUseRebase(e.target.checked);
            if (e.target.checked) setUseFfOnly(false);
          }}
          className="mt-0.5 accent-text cursor-pointer"
        />
        <div className="min-w-0">
          <div className="text-xs font-semibold text-text group-hover:text-text transition-colors">
            Rebase local commits onto upstream (<code className="font-mono">--rebase</code>)
          </div>
          <div className="text-[10px] text-subtext0">
            Maintains a clean, linear git history without creating superfluous merge commits
          </div>
        </div>
      </label>

      {/* --autostash */}
      <label className="flex items-start gap-2.5 cursor-pointer py-1 group">
        <input
          type="checkbox"
          checked={useAutostash}
          onChange={(e) => setUseAutostash(e.target.checked)}
          className="mt-0.5 accent-text cursor-pointer"
        />
        <div className="min-w-0">
          <div className="text-xs font-semibold text-text group-hover:text-text transition-colors">
            Autostash uncommitted changes (<code className="font-mono">--autostash</code>)
          </div>
          <div className="text-[10px] text-subtext0">
            Automatically stashes modified workspace files before pull and restores them afterward
          </div>
        </div>
      </label>

      {/* --ff-only */}
      <label className="flex items-start gap-2.5 cursor-pointer py-1 group">
        <input
          type="checkbox"
          checked={useFfOnly}
          disabled={useRebase}
          onChange={(e) => setUseFfOnly(e.target.checked)}
          className="mt-0.5 accent-text cursor-pointer disabled:opacity-40"
        />
        <div className={`min-w-0 ${useRebase ? 'opacity-40' : ''}`}>
          <div className="text-xs font-semibold text-text group-hover:text-text transition-colors">
            Fast-forward only (<code className="font-mono">--ff-only</code>)
          </div>
          <div className="text-[10px] text-subtext0">
            Refuses to merge if local branch has diverged, preventing accidental merge commits
          </div>
        </div>
      </label>

      {/* --no-commit */}
      <label className="flex items-start gap-2.5 cursor-pointer py-1 group">
        <input
          type="checkbox"
          checked={useNoCommit}
          disabled={useRebase}
          onChange={(e) => setUseNoCommit(e.target.checked)}
          className="mt-0.5 accent-text cursor-pointer disabled:opacity-40"
        />
        <div className={`min-w-0 ${useRebase ? 'opacity-40' : ''}`}>
          <div className="text-xs font-semibold text-text group-hover:text-text transition-colors">
            No commit (<code className="font-mono">--no-commit</code>)
          </div>
          <div className="text-[10px] text-subtext0">
            Merges changes into working directory but does not auto-commit, allowing review
          </div>
        </div>
      </label>
    </div>
  );
}
