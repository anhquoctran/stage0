import { Bot } from '../../../../common/components/icons/Bot';
import { Check } from '../../../../common/components/icons/Check';
import { FileCode } from '../../../../common/components/icons/FileCode';
import { GitCommit } from '../../../../common/components/icons/GitCommit';
import { MessageSquare } from '../../../../common/components/icons/MessageSquare';
import { Plus } from '../../../../common/components/icons/Plus';
import { User } from '../../../../common/components/icons/User';
import { X } from '../../../../common/components/icons/X';
import { type BotReviewer } from '../../types/BotReviewer';
import type { VirtualMrMetadataBarProps } from './VirtualMrMetadataBarProps';

export function VirtualMrMetadataBar({
  session,
  removeReviewerBot,
  toggleReviewerDropdown,
  showReviewerDropdown,
  isLoadingReviewerOptions,
  effectiveReviewers,
  assignReviewerBot,
  setShowReviewerDropdown,
  toggleLabelDropdown,
  showLabelDropdown,
  setShowLabelDropdown,
  openRepoSettings,
  isLoadingLabelOptions,
  repoLabels,
  toggleSessionLabel,
  setActiveMrTab,
  activeMrTab,
  diffPayload,
}: VirtualMrMetadataBarProps) {
  return (
    <div className="px-4 py-2 flex items-center justify-between gap-4 bg-mantle text-xs border-b border-surface0/40">
      <div className="flex items-center gap-6 flex-wrap">
        {/* Assignee */}
        <div className="flex items-center gap-2">
          <span className="text-subtext0">Assignee:</span>
          <div className="flex items-center gap-1.5 px-2 py-0.5  bg-surface0 font-medium">
            <User className="w-3 h-3 text-accent" />
            <span>{session.assignee.name}</span>
            <span className="text-[10px] text-subtext0 font-mono">(Local)</span>
          </div>
        </div>

        {/* Reviewers (AI Bots) */}
        <div className="relative flex items-center gap-2">
          <span className="text-subtext0">Reviewers:</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {session.reviewers.map((rev) => (
              <div
                key={rev.agentId}
                className="flex items-center gap-1 px-2 py-0.5  bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[11px]"
              >
                <Bot className="w-3 h-3" />
                <span>{rev.agentName}</span>
                <button
                  type="button"
                  onClick={() => removeReviewerBot(session.id, rev.agentId)}
                  className="hover:text-red-400 cursor-pointer ml-0.5"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={toggleReviewerDropdown}
              className="p-1  bg-surface1 hover:bg-surface2 text-white cursor-pointer"
              title="Add AI Reviewer Bot"
            >
              <Plus className="w-3 h-3 text-white" />
            </button>
          </div>

          {/* Reviewer Dropdown */}
          {showReviewerDropdown && (
            <div className="absolute top-full left-16 mt-1 w-60  bg-crust border border-surface0 shadow-xl py-1 z-50">
              <div className="px-3 py-1.5 text-[11px] font-semibold text-subtext0 uppercase tracking-wider">
                Select AI Reviewer Bot
              </div>
              {isLoadingReviewerOptions ? (
                <div className="px-3 py-3 text-xs text-subtext0">Loading reviewers...</div>
              ) : effectiveReviewers.length === 0 ? (
                <div className="px-3 py-3 text-xs text-subtext0">No reviewers configured.</div>
              ) : (
                effectiveReviewers.map((bot: BotReviewer) => {
                  const isAssigned = session.reviewers.some((r) => r.agentId === bot.id);
                  return (
                    <button
                      key={bot.id}
                      type="button"
                      disabled={isAssigned}
                      onClick={() => {
                        assignReviewerBot(session.id, bot.id);
                        setShowReviewerDropdown(false);
                      }}
                      className="w-full px-3 py-1.5 flex items-center justify-between text-left hover:bg-surface0 disabled:opacity-40 cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span>{bot.avatarEmoji}</span>
                        <div>
                          <div className="text-xs font-medium">{bot.name}</div>
                          <div className="text-[10px] text-subtext0">{bot.tagline}</div>
                        </div>
                      </div>
                      {isAssigned && <Check className="w-3.5 h-3.5 text-accent" />}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Labels */}
        <div className="relative flex items-center gap-2">
          <span className="text-subtext0">Labels:</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {session.labels.map((lbl) => (
              <span
                key={lbl.id}
                className="px-2 py-0.5  text-[10px] font-medium text-white shadow-2xs"
                style={{ backgroundColor: lbl.color }}
              >
                {lbl.name}
              </span>
            ))}
            <button
              type="button"
              onClick={toggleLabelDropdown}
              className="p-1  bg-surface1 hover:bg-surface2 text-white cursor-pointer"
              title="Manage Labels"
            >
              <Plus className="w-3 h-3 text-white" />
            </button>
          </div>

          {/* Label Dropdown */}
          {showLabelDropdown && (
            <div className="absolute top-full left-14 mt-1 w-56  bg-crust border border-surface0 shadow-xl py-1 z-50">
              <div className="px-3 py-1.5 flex items-center justify-between text-[11px] font-semibold text-subtext0 uppercase tracking-wider border-b border-surface0/60">
                <span>Toggle Labels</span>
                <button
                  onClick={() => {
                    setShowLabelDropdown(false);
                    openRepoSettings('labels');
                  }}
                  className="text-accent hover:underline text-[10px] lowercase"
                >
                  manage
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto py-1">
                {isLoadingLabelOptions ? (
                  <div className="px-3 py-3 text-xs text-subtext0">Loading labels...</div>
                ) : (
                  repoLabels.map((lbl) => {
                    const isChecked = session.labels.some((l) => l.id === lbl.id);
                    return (
                      <button
                        key={lbl.id}
                        type="button"
                        onClick={() => toggleSessionLabel(session.id, lbl.id)}
                        className="w-full px-3 py-1.5 flex items-center justify-between text-left hover:bg-surface0 cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5  shrink-0"
                            style={{ backgroundColor: lbl.color }}
                          />
                          <span className="text-xs">{lbl.name}</span>
                        </div>
                        {isChecked && <Check className="w-3.5 h-3.5 text-accent" />}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SUB-TABS NAVIGATION */}
      <div className="flex items-center gap-1 bg-crust p-0.5 shrink-0">
        <button
          type="button"
          onClick={() => setActiveMrTab('overview')}
          className={`px-3 py-1 text-xs transition-colors flex items-center gap-1.5 cursor-pointer ${
            activeMrTab === 'overview'
              ? 'bg-surface2 text-white font-medium shadow-2xs'
              : 'bg-surface0 text-white/80 hover:text-white hover:bg-surface1'
          }`}
        >
          <MessageSquare className="w-3 h-3 text-white" />
          <span>Overview ({session.discussions.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveMrTab('commits')}
          className={`px-3 py-1 text-xs transition-colors flex items-center gap-1.5 cursor-pointer ${
            activeMrTab === 'commits'
              ? 'bg-surface2 text-white font-medium shadow-2xs'
              : 'bg-surface0 text-white/80 hover:text-white hover:bg-surface1'
          }`}
        >
          <GitCommit className="w-3 h-3 text-white" />
          <span>Commits ({session.commits.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveMrTab('diff')}
          className={`px-3 py-1 text-xs transition-colors flex items-center gap-1.5 cursor-pointer ${
            activeMrTab === 'diff'
              ? 'bg-surface2 text-white font-medium shadow-2xs'
              : 'bg-surface0 text-white/80 hover:text-white hover:bg-surface1'
          }`}
        >
          <FileCode className="w-3 h-3 text-white" />
          <span>Files Changed ({diffPayload?.files.length || 0})</span>
        </button>
      </div>
    </div>
  );
}
