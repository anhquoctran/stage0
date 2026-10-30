import { useTranslation as useUiTextTranslation } from 'react-i18next';
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
  const { t: translateUiText } = useUiTextTranslation();
  return (
    <div className="space-y-2 pt-2 border-t border-surface0/80">
      <span className="text-[11px] font-bold uppercase tracking-wider text-subtext0 block mb-1">
        {translateUiText('git.pullOptions.advancedOptions')}
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
            {translateUiText('git.pullOptions.rebaseLabel')} (<code className="font-mono">--rebase</code>)
          </div>
          <div className="text-[10px] text-subtext0">
            {translateUiText('git.pullOptions.rebaseDescription')}
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
            {translateUiText('git.pullOptions.autostashLabel')} (<code className="font-mono">--autostash</code>)
          </div>
          <div className="text-[10px] text-subtext0">
            {translateUiText('git.pullOptions.autostashDescription')}
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
            {translateUiText('git.pullOptions.fastForwardOnlyLabel')} (<code className="font-mono">--ff-only</code>)
          </div>
          <div className="text-[10px] text-subtext0">
            {translateUiText('git.pullOptions.fastForwardOnlyDescription')}
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
            {translateUiText('git.pullOptions.noCommitLabel')} (<code className="font-mono">--no-commit</code>)
          </div>
          <div className="text-[10px] text-subtext0">
            {translateUiText('git.pullOptions.noCommitDescription')}
          </div>
        </div>
      </label>
    </div>
  );
}
