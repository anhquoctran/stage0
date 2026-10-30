import React from 'react';
import { useTranslation as useUiTextTranslation } from 'react-i18next';
import { Bot } from '../../../common/components/icons/Bot';
import { Plus } from '../../../common/components/icons/Plus';
import { X } from '../../../common/components/icons/X';
import { Check } from '../../../common/components/icons/Check';
import type { BotReviewer } from '../types/BotReviewer';

export const NewVirtualMrReviewersSection: React.FC<{
  selectedBots: string[];
  effectiveReviewers: BotReviewer[];
  isLoadingReviewerOptions: boolean;
  showBotDropdown: boolean;
  setShowBotDropdown: (show: boolean) => void;
  onToggleReviewerDropdown: () => void;
  onToggleBot: (botId: string) => void;
  onRemoveBot: (botId: string) => void;
  botDropdownRef: React.RefObject<HTMLDivElement | null>;
}> = ({
  selectedBots,
  effectiveReviewers,
  isLoadingReviewerOptions,
  showBotDropdown,
  setShowBotDropdown,
  onToggleReviewerDropdown,
  onToggleBot,
  onRemoveBot,
  botDropdownRef,
}) => {
  const { t: translateUiText } = useUiTextTranslation();
  return (
    <div className="relative p-3 border border-surface1 bg-mantle/70 space-y-2 select-none rounded-sm" ref={botDropdownRef}>
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-bold uppercase tracking-wider text-subtext1 flex items-center gap-1.5">
          <Bot className="w-3.5 h-3.5 text-brand" />
          <span>{translateUiText('virtualMr.newMrReviewers.title')}</span>
        </div>
        <button
          type="button"
          onClick={onToggleReviewerDropdown}
          className="p-1 text-subtext0 hover:text-brand hover:bg-surface0 transition-colors cursor-pointer rounded-sm"
          title={translateUiText('virtualMr.newMrReviewers.assignTitle')}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Selected Reviewers Chips or Empty State */}
      {selectedBots.length === 0 ? (
        <div className="text-xs text-subtext0/70 italic py-0.5">
          {translateUiText('virtualMr.newMrReviewers.noneRequested')}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {selectedBots.map((botId) => {
              const bot = effectiveReviewers.find((b: BotReviewer) => b.id === botId);
              if (!bot) return null;
              return (
                <div
                  key={bot.id}
                  className="flex items-center gap-1.5 px-2 py-0.5 bg-brand/10 border border-brand/20 text-brand text-xs font-medium rounded-sm"
                >
                  <span>{bot.avatarEmoji}</span>
                  <span className="truncate max-w-[130px]">{bot.name}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveBot(bot.id)}
                    className="text-brand/60 hover:text-red hover:bg-surface0 transition-colors cursor-pointer ms-0.5 rounded-sm"
                    title={translateUiText('virtualMr.newMrReviewers.remove', { name: bot.name })}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] leading-relaxed text-subtext0">
            {translateUiText('virtualMr.newMrReviewers.reviewNotice')}
          </p>
        </div>
      )}

      {/* Reviewer Dropdown Popover */}
      {showBotDropdown && (
        <div className="absolute top-full end-0 mt-1 w-64 bg-mantle border border-surface0 shadow-2xl z-50 py-1 animate-in fade-in zoom-in-95 duration-100 rounded-sm">
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-subtext0 bg-base/60 border-b border-surface0/60 flex items-center justify-between rounded-sm">
            <span>{translateUiText('virtualMr.newMrReviewers.assignReviewer')}</span>
            <button
              type="button"
              onClick={() => setShowBotDropdown(false)}
              className="text-subtext0 hover:text-text cursor-pointer rounded-sm"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <div className="max-h-56 overflow-y-auto divide-y divide-surface0/60">
            {isLoadingReviewerOptions ? (
              <div className="px-3 py-6 text-center text-xs text-subtext0/70 italic">
                {translateUiText('virtualMr.newMrReviewers.loading')}
              </div>
            ) : effectiveReviewers.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-subtext0/70 italic">
                {translateUiText('virtualMr.newMrReviewers.noneAvailable')}
              </div>
            ) : (
              effectiveReviewers.map((bot: BotReviewer) => {
                const isAssigned = selectedBots.includes(bot.id);
                return (
                  <button
                    key={bot.id}
                    type="button"
                    onClick={() => onToggleBot(bot.id)}
                    className={`w-full px-3 py-2 flex items-center justify-between text-start transition-colors cursor-pointer rounded-sm ${
                      isAssigned ? 'bg-brand/10 text-brand' : 'hover:bg-surface0 text-text'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 pe-2">
                      <span className="text-[1rem] shrink-0">{bot.avatarEmoji}</span>
                      <div className="truncate">
                        <div className="text-xs font-medium truncate">{bot.name}</div>
                        <div className="text-[10px] text-subtext0 truncate">{bot.tagline}</div>
                      </div>
                    </div>
                    {isAssigned && <Check className="w-3.5 h-3.5 text-brand shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

