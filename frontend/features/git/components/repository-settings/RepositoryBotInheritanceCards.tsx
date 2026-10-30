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
  const { t: translateUiText } = useUiTextTranslation();
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
              <span className="font-semibold text-xs text-text">{translateUiText('git.repositoryBotInheritance.inheritGlobal')}</span>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-[0.2rem] bg-brand/20 text-brand border border-brand/30">
              {translateUiText('git.repositoryBotInheritance.default')}
            </span>
          </div>
          <p className="text-[11px] text-subtext0 leading-relaxed ps-5">
            {translateUiText('git.repositoryBotInheritance.inheritDescription')}
          </p>
        </div>

        <div className="pt-2 mt-2 border-t border-surface0/60 ps-5 flex items-center justify-between">
          <span className="text-[11px] text-brand font-medium">
            {translateUiText('git.repositoryBotInheritance.globalBotsActive', { count: globalReviewers.filter((b) => b.enabled).length })}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
              setIsPreferencesOpen(true);
            }}
            className="text-[11px] text-subtext0 hover:text-text flex items-center gap-1 cursor-pointer hover:underline rounded-sm"
            title={translateUiText('git.repositoryBotInheritance.openPreferencesTitle')}
          >
            <span>{translateUiText('git.repositoryBotInheritance.openPreferences')}</span>
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
              <span className="font-semibold text-xs text-text">{translateUiText('git.repositoryBotInheritance.customForRepository')}</span>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-[0.2rem] bg-surface1 text-subtext0 border border-surface2">
              {translateUiText('git.repositoryBotInheritance.isolated')}
            </span>
          </div>
          <p className="text-[11px] text-subtext0 leading-relaxed ps-5">
            {translateUiText('git.repositoryBotInheritance.customDescription')}
          </p>
        </div>

        <div className="pt-2 mt-2 border-t border-surface0/60 ps-5 flex items-center justify-between">
          <span className="text-[11px] text-accent font-medium">
            {translateUiText('git.repositoryBotInheritance.repoBotsEnabled', { count: activeBotSet.size })}
          </span>
          {!inheritAgents && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                resetRepoToGlobal(currentRepoId);
                showToast(translateUiText('git.repositoryBotInheritance.resetToast'));
              }}
              className="text-[11px] text-subtext0 hover:text-text flex items-center gap-1 cursor-pointer rounded-sm"
              title={translateUiText('git.repositoryBotInheritance.resetTitle')}
            >
              <RotateCcw className="w-3 h-3" />
              <span>{translateUiText('git.repositoryBotInheritance.reset')}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
import { useTranslation as useUiTextTranslation } from 'react-i18next';
