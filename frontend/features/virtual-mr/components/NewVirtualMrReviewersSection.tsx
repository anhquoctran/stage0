import React from 'react';
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
  return (
    <div className="relative p-3 border border-surface1 bg-mantle/70 space-y-2 select-none" ref={botDropdownRef}>
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-bold uppercase tracking-wider text-subtext1 flex items-center gap-1.5">
          <Bot className="w-3.5 h-3.5 text-brand" />
          <span>Reviewers</span>
        </div>
        <button
          type="button"
          onClick={onToggleReviewerDropdown}
          className="p-1 text-subtext0 hover:text-brand hover:bg-surface0 transition-colors cursor-pointer"
          title="Assign Reviewer Bots"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Selected Reviewers Chips or Empty State */}
      {selectedBots.length === 0 ? (
        <div className="text-xs text-subtext0/70 italic py-0.5">
          No reviewers requested
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
                  className="flex items-center gap-1.5 px-2 py-0.5 bg-brand/10 border border-brand/20 text-brand text-xs font-medium"
                >
                  <span>{bot.avatarEmoji}</span>
                  <span className="truncate max-w-[130px]">{bot.name}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveBot(bot.id)}
                    className="text-brand/60 hover:text-red hover:bg-surface0 transition-colors cursor-pointer ml-0.5"
                    title={`Remove ${bot.name}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] leading-relaxed text-subtext0">
            Creating this MR starts a review with the first selected reviewer. Eligible tracked source may be sent to its configured provider.
          </p>
        </div>
      )}

      {/* Reviewer Dropdown Popover */}
      {showBotDropdown && (
        <div className="absolute top-full right-0 mt-1 w-64 bg-mantle border border-surface0 shadow-2xl z-50 py-1 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-subtext0 bg-base/60 border-b border-surface0/60 flex items-center justify-between">
            <span>Assign AI Reviewer</span>
            <button
              type="button"
              onClick={() => setShowBotDropdown(false)}
              className="text-subtext0 hover:text-text cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <div className="max-h-56 overflow-y-auto divide-y divide-surface0/60">
            {isLoadingReviewerOptions ? (
              <div className="px-3 py-6 text-center text-xs text-subtext0/70 italic">
                Loading reviewers...
              </div>
            ) : effectiveReviewers.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-subtext0/70 italic">
                No AI reviewers available
              </div>
            ) : (
              effectiveReviewers.map((bot: BotReviewer) => {
                const isAssigned = selectedBots.includes(bot.id);
                return (
                  <button
                    key={bot.id}
                    type="button"
                    onClick={() => onToggleBot(bot.id)}
                    className={`w-full px-3 py-2 flex items-center justify-between text-left transition-colors cursor-pointer ${
                      isAssigned ? 'bg-brand/10 text-brand' : 'hover:bg-surface0 text-text'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
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

