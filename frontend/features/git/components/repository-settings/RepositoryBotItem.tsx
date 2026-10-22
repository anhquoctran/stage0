import { Trash2 } from '../../../../common/components/icons/Trash2';
import type { RepositoryBotItemProps } from './RepositoryBotItemProps';

export function RepositoryBotItem({
  bot,
  toggleRepoActiveBotId,
  currentRepoId,
  isChecked,
  isRepoExclusive,
  externalAgents,
  deleteRepoCustomReviewer,
}: RepositoryBotItemProps) {
  return (
    <div
      key={bot.id}
      onClick={() => toggleRepoActiveBotId(currentRepoId, bot.id)}
      className={`p-3 border space-y-2 flex flex-col justify-between cursor-pointer transition-all ${
        isChecked
          ? 'bg-surface0/30 border-surface1 shadow-xs'
          : 'bg-crust border-surface0/50 opacity-60'
      }`}
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isChecked}
            onChange={() => toggleRepoActiveBotId(currentRepoId, bot.id)}
            className="border-surface1 text-accent focus:ring-0 cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          />
          <span className="text-xl p-1 bg-surface0">{bot.avatarEmoji}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-text truncate">{bot.name}</span>
              {isRepoExclusive ? (
                <span className="text-[9px] font-mono px-1.5 py-0.2 bg-accent/20 text-accent border border-accent/30">
                  Repo Custom
                </span>
              ) : (
                <span className="text-[9px] font-mono px-1.5 py-0.2 bg-surface1 text-subtext0">
                  Global
                </span>
              )}
            </div>
            <span className="text-[10px] text-subtext0 font-mono truncate block">
              {bot.tagline}
            </span>
            <span className="text-[10px] text-accent font-mono truncate block">
              {bot.acpAgentId
                ? `ACP · ${externalAgents.find((agent) => agent.id === bot.acpAgentId)?.name || 'Agent unavailable'}${bot.allowAcpSourceTransfer ? '' : ' · source consent required'}`
                : 'Built-in LLM provider'}
            </span>
          </div>
        </div>
        <p className="text-[11px] text-subtext0 line-clamp-2 mt-1">{bot.description}</p>
      </div>

      <div className="pt-2 border-t border-surface0/60 flex items-center justify-between text-[11px]">
        <span
          className={`flex items-center gap-1 font-mono text-[10px] ${
            isChecked ? 'text-accent font-medium' : 'text-subtext0'
          }`}
        >
          {isChecked ? '✓ Enabled for repo' : 'Disabled for repo'}
        </span>
        {isRepoExclusive && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              deleteRepoCustomReviewer(currentRepoId, bot.id);
            }}
            className="text-subtext0 hover:text-red-400 p-0.5 cursor-pointer"
            title="Delete repo-exclusive bot"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}
