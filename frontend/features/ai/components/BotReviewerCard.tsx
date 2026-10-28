import React from 'react';
import { ChevronDown } from '../../../common/components/icons/ChevronDown';
import { ChevronUp } from '../../../common/components/icons/ChevronUp';
import { Copy } from '../../../common/components/icons/Copy';
import { Edit2 } from '../../../common/components/icons/Edit2';
import { Trash2 } from '../../../common/components/icons/Trash2';
import { getBotRolePrompt } from '../utils/botRolePrompts';
import { getCategoryInfo } from '../constants/botReviewerConstants';
import type { BotReviewer } from '../../virtual-mr/types/BotReviewer';
import type { AcpAgentConfig } from '../types/AcpAgentConfig';

export const BotReviewerCard: React.FC<{
  bot: BotReviewer;
  externalAgents: AcpAgentConfig[];
  isPromptExpanded: boolean;
  onTogglePrompt: () => void;
  onToggleEnabled: (id: string) => void;
  onOpenEdit: (bot: BotReviewer) => void;
  onCloneBot: (bot: BotReviewer) => void;
  onDeleteBot: (id: string) => void;
}> = ({
  bot,
  externalAgents,
  isPromptExpanded,
  onTogglePrompt,
  onToggleEnabled,
  onOpenEdit,
  onCloneBot,
  onDeleteBot,
}) => {
  const cat = getCategoryInfo(bot.category);

  return (
    <div
      className={`p-4 bg-surface0/30 border transition-all rounded-sm ${
        bot.enabled
          ? 'border-surface0 hover:border-surface1'
          : 'border-surface0/50 opacity-65 bg-surface0/10'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <span className="text-2xl p-1.5 bg-surface0 border border-surface1 shrink-0">
            {bot.avatarEmoji}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-text truncate">{bot.name}</span>
              <span className={`px-2 py-0.5 text-[10px] font-semibold border ${cat.bg}`}>
                {cat.label}
              </span>
              {bot.isBuiltin ? (
                <span className="px-1.5 py-0.2 text-[9px] font-mono bg-surface1 text-subtext0 border border-surface2/60">
                  Built-in
                </span>
              ) : (
                <span className="px-1.5 py-0.2 text-[9px] font-mono bg-brand/10 text-brand border border-brand/20">
                  Custom
                </span>
              )}
            </div>
            <div className="text-xs text-subtext0 font-mono mt-0.5 truncate">
              {bot.tagline}
            </div>
            <p className="text-xs text-subtext0/90 mt-1 line-clamp-2 leading-relaxed">
              {bot.description}
            </p>
          </div>
        </div>

        {/* Switch Toggle */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            role="switch"
            aria-checked={bot.enabled}
            onClick={() => onToggleEnabled(bot.id)}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-0 p-0.5 transition-colors duration-200 ease-in-out focus:outline-none ${
              bot.enabled ? 'bg-brand' : 'bg-surface1'
            }`}
            title={bot.enabled ? 'Click to disable globally' : 'Click to enable globally'}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 shrink-0 transform rounded-full bg-base shadow-lg ring-0 transition duration-200 ease-in-out ${
                bot.enabled ? 'translate-x-4 rtl:-translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Prompt & Config Bar */}
      <div className="mt-3 pt-3 border-t border-surface0/60 flex items-center justify-between text-xs text-subtext0">
        <div className="flex items-center gap-3 flex-wrap text-[11px]">
          <button
            type="button"
            onClick={onTogglePrompt}
            className="flex items-center gap-1 hover:text-text cursor-pointer font-medium text-brand rounded-sm"
          >
            {isPromptExpanded ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                <span>Hide System Prompt</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>Inspect System Prompt</span>
              </>
            )}
          </button>

          <span className="text-surface2">|</span>

          <span className="font-mono text-subtext0/80">
            {bot.acpAgentId ? 'ACP agent: ' : 'Model: '}
            <strong className="text-text font-normal">
              {bot.acpAgentId
                ? externalAgents.find((agent) => agent.id === bot.acpAgentId)?.name || 'Agent unavailable'
                : bot.model === 'global_default' || !bot.model ? 'Global Default' : bot.model}
            </strong>
          </span>
          {bot.acpAgentId && !bot.allowAcpSourceTransfer && (
            <span className="font-mono text-yellow">ACP source consent required</span>
          )}

          {bot.temperature !== undefined && (
            <span className="font-mono text-subtext0/80">
              Temp: <strong className="text-text font-normal">{bot.temperature}</strong>
            </span>
          )}
          {bot.reasoningEffort && (
            <span className="font-mono text-subtext0/80">
              Effort: <strong className="text-text font-normal">{bot.reasoningEffort}</strong>
            </span>
          )}
          {bot.fastMode === true && (
            <span className="font-mono text-subtext0/80">Fast mode</span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onCloneBot(bot)}
            className="p-1.5 hover:bg-surface0 text-subtext0 hover:text-text transition-colors cursor-pointer rounded-sm"
            title="Clone this reviewer bot"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onOpenEdit(bot)}
            className="p-1.5 hover:bg-surface0 text-subtext0 hover:text-text transition-colors cursor-pointer rounded-sm"
            title="Edit bot settings and prompt"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          {!bot.isBuiltin && (
            <button
              type="button"
              onClick={() => onDeleteBot(bot.id)}
              className="p-1.5 hover:bg-red/20 text-subtext0 hover:text-red transition-colors cursor-pointer rounded-sm"
              title="Delete custom bot"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Expanded Prompt Viewer */}
      {isPromptExpanded && (
        <div className="mt-3 p-3 bg-crust border border-surface0/80 space-y-1.5 animate-in fade-in duration-150 rounded-sm">
          <div className="flex items-center justify-between text-[11px] text-subtext0 font-mono">
            <span>STAGE0 ROLE PROMPT · {getCategoryInfo(bot.category).label.toUpperCase()}</span>
            <span>{getBotRolePrompt(bot.category).length} characters</span>
          </div>
          <pre className="text-xs font-mono text-subtext1 whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto select-text p-1">
            {getBotRolePrompt(bot.category)}
          </pre>
          {bot.customInstructions.trim() && (
            <>
              <div className="flex items-center justify-between text-[11px] text-subtext0 font-mono pt-2">
                <span>USER ADDITIONAL INSTRUCTIONS</span>
                <span>{bot.customInstructions.length} characters</span>
              </div>
              <pre className="text-xs font-mono text-subtext1 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto select-text p-1">
                {bot.customInstructions}
              </pre>
            </>
          )}
        </div>
      )}
    </div>
  );
};

