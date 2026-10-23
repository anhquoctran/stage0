import { Radio } from '../../../../common/components/Radio';
import { ExternalLink } from '../../../../common/components/icons/ExternalLink';
import { RotateCcw } from '../../../../common/components/icons/RotateCcw';
import type { RepositoryBotInheritanceCardsProps } from './RepositoryBotInheritanceCardsProps';

export function RepositoryBotInheritanceCards({
  setInheritAgents,
  inheritAgents,
  globalReviewers,
  onClose,
  setIsPreferencesOpen,
  activeBotSet,
  resetRepoToGlobal,
  currentRepoId,
  showToast,
}: RepositoryBotInheritanceCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Option 1: Inherit Global (Default) */}
      <div
        onClick={() => setInheritAgents(true)}
        className={`p-3.5 border cursor-pointer transition-all flex flex-col justify-between rounded-sm ${
          inheritAgents
            ? 'bg-brand/5 border-brand/60 shadow-xs'
            : 'bg-crust border-surface0 hover:border-surface1 opacity-80'
        }`}
      >
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio
                name="reviewer-inheritance"
                checked={inheritAgents}
                onChange={() => setInheritAgents(true)}
              />
              <span className="font-semibold text-xs text-text">Inherit Global Preferences</span>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.2 bg-brand/20 text-brand border border-brand/30">
              Default
            </span>
          </div>
          <p className="text-[11px] text-subtext0 leading-relaxed pl-5">
            Automatically inherits all active Bot Reviewers and AI model settings configured in App
            Preferences.
          </p>
        </div>

        <div className="pt-2 mt-2 border-t border-surface0/60 pl-5 flex items-center justify-between">
          <span className="text-[11px] text-brand font-medium">
            {globalReviewers.filter((b) => b.enabled).length} global bots active
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
              setIsPreferencesOpen(true);
            }}
            className="text-[11px] text-subtext0 hover:text-text flex items-center gap-1 cursor-pointer hover:underline rounded-sm"
            title="Open App Preferences modal"
          >
            <span>Open Preferences</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Option 2: Custom for this Repo */}
      <div
        onClick={() => setInheritAgents(false)}
        className={`p-3.5 border cursor-pointer transition-all flex flex-col justify-between rounded-sm ${
          !inheritAgents
            ? 'bg-accent/5 border-accent/60 shadow-xs'
            : 'bg-crust border-surface0 hover:border-surface1 opacity-80'
        }`}
      >
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio
                name="reviewer-inheritance"
                checked={!inheritAgents}
                onChange={() => setInheritAgents(false)}
              />
              <span className="font-semibold text-xs text-text">Custom for this Repository</span>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.2 bg-surface1 text-subtext0 border border-surface2">
              Isolated
            </span>
          </div>
          <p className="text-[11px] text-subtext0 leading-relaxed pl-5">
            Override active bots independently for this repository, or add repository-exclusive
            custom reviewer bots.
          </p>
        </div>

        <div className="pt-2 mt-2 border-t border-surface0/60 pl-5 flex items-center justify-between">
          <span className="text-[11px] text-accent font-medium">
            {activeBotSet.size} bots enabled for repo
          </span>
          {!inheritAgents && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                resetRepoToGlobal(currentRepoId);
                showToast('Reset bot selections to global defaults');
              }}
              className="text-[11px] text-subtext0 hover:text-text flex items-center gap-1 cursor-pointer rounded-sm"
              title="Reset to global active selection"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
