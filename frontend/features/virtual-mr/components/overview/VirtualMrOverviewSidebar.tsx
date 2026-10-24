import React, { useMemo, useRef } from 'react';
import { useOutsideDismiss } from '../../../../common/hooks/useOutsideDismiss';
import { Check } from '../../../../common/components/icons/Check';
import { Plus } from '../../../../common/components/icons/Plus';
import { X } from '../../../../common/components/icons/X';
import { useBotReviewersStore } from '../../../ai/store/useBotReviewersStore';
import { useGitStore } from '../../../git/store/useGitStore';
import { useVirtualMrStore } from '../../store/useVirtualMrStore';
import type { ReviewerState } from '../../types/ReviewerState';
import { getVirtualMrParticipants } from '../../utils/virtualMrParticipants';
import { GitLabAvatar } from '../GitLabAvatar';
import { useMrMetadataDropdowns } from '../useMrMetadataDropdowns';
import type { VirtualMrOverviewSidebarProps } from './VirtualMrOverviewSidebarProps';

function renderReviewerStatusBadge(status: ReviewerState) {
  switch (status) {
    case 'approved':
      return (
        <span className="px-1.5 py-0.5 rounded-sm text-[10px] font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center gap-1">
          <Check className="w-2.5 h-2.5" />
          <span>Approved</span>
        </span>
      );
    case 'changes_requested':
      return (
        <span className="px-1.5 py-0.5 rounded-sm text-[10px] font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-300">
          Changes requested
        </span>
      );
    case 'reviewing':
      return (
        <span className="px-1.5 py-0.5 rounded-sm text-[10px] font-semibold bg-purple-500/15 border border-purple-500/30 text-purple-300 animate-pulse">
          Reviewing
        </span>
      );
    case 'commented':
      return (
        <span className="px-1.5 py-0.5 rounded-sm text-[10px] bg-surface1 text-subtext0">
          Commented
        </span>
      );
    case 'pending':
    default:
      return (
        <span className="px-1.5 py-0.5 rounded-sm text-[10px] bg-surface0 text-subtext0">
          Pending
        </span>
      );
  }
}

export const VirtualMrOverviewSidebar: React.FC<VirtualMrOverviewSidebarProps> = ({
  session,
}) => {
  const { currentRepo } = useGitStore();
  const {
    removeReviewerBot,
    assignReviewerBot,
    toggleSessionLabel,
    openRepoSettings,
    repoLabels,
    repoSettings,
    refreshRepoMetadata,
  } = useVirtualMrStore();

  const {
    getEffectiveReviewers,
    globalReviewers,
    repoActiveBotIds,
    repoCustomReviewers,
    reloadPersistedReviewers,
  } = useBotReviewersStore();

  const { reviewers: effectiveReviewers } = useMemo(() => {
    return getEffectiveReviewers(currentRepo?.id, repoSettings?.inheritGlobalAgents);
  }, [
    currentRepo?.id,
    repoSettings?.inheritGlobalAgents,
    getEffectiveReviewers,
    globalReviewers,
    repoActiveBotIds,
    repoCustomReviewers,
  ]);

  const {
    toggleReviewerDropdown,
    showReviewerDropdown,
    isLoadingReviewerOptions,
    setShowReviewerDropdown,
    toggleLabelDropdown,
    showLabelDropdown,
    setShowLabelDropdown,
    isLoadingLabelOptions,
  } = useMrMetadataDropdowns({ reloadPersistedReviewers, currentRepo, refreshRepoMetadata });
  const reviewerDropdownRef = useRef<HTMLDivElement>(null);
  const labelDropdownRef = useRef<HTMLDivElement>(null);
  useOutsideDismiss(reviewerDropdownRef, showReviewerDropdown, () => setShowReviewerDropdown(false));
  useOutsideDismiss(labelDropdownRef, showLabelDropdown, () => setShowLabelDropdown(false));

  const participants = useMemo(() => getVirtualMrParticipants(session), [session]);

  const assigneeUsername = useMemo(() => {
    if (!session.assignee) return '';
    if (session.assignee.email) {
      return session.assignee.email.split('@')[0];
    }
    return session.assignee.name.toLowerCase().replace(/\s+/g, '');
  }, [session.assignee]);

  return (
    <aside className="space-y-6 text-xs text-text select-none">
      {/* 1. ASSIGNEE */}
      <div className="space-y-2">
        <div className="text-[11px] font-semibold text-subtext0 uppercase tracking-wider">
          Assignee
        </div>
        {session.assignee?.name ? (
          <div className="flex items-center gap-2.5">
            <GitLabAvatar
              name={session.assignee.name}
              email={session.assignee.email}
              avatarUrl={session.assignee.avatarUrl}
              size="sm"
            />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-text truncate">
                {session.assignee.name}
              </div>
              <div className="text-[11px] text-subtext0 font-mono truncate">
                @{assigneeUsername}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-subtext0 italic">None</p>
        )}
      </div>

      <div className="border-b border-surface0/60" />

      {/* 2. REVIEWERS */}
      <div ref={reviewerDropdownRef} className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-subtext0 uppercase tracking-wider">
            Reviewers
          </span>
          <button
            type="button"
            onClick={() => void toggleReviewerDropdown()}
            className="text-xs text-primary hover:underline flex items-center gap-1 cursor-pointer rounded-sm"
            title="Add AI reviewer bot"
          >
            <Plus className="w-3 h-3" />
            <span>Add</span>
          </button>
        </div>

        {/* Reviewer Dropdown */}
        {showReviewerDropdown && (
          <div className="relative z-50">
            <div className="rounded-sm bg-crust border border-surface0 shadow-xl py-1 my-1">
              <div className="px-3 py-1.5 text-[11px] font-semibold text-subtext0 uppercase tracking-wider border-b border-surface0/60">
                Select AI Reviewer Bot
              </div>
              {isLoadingReviewerOptions ? (
                <div className="px-3 py-3 text-xs text-subtext0">Loading reviewers...</div>
              ) : effectiveReviewers.length === 0 ? (
                <div className="px-3 py-3 text-xs text-subtext0">No reviewers configured.</div>
              ) : (
                <div className="max-h-48 overflow-y-auto py-1">
                  {effectiveReviewers.map((bot) => {
                    const isAssigned = session.reviewers.some((r) => r.agentId === bot.id);
                    return (
                      <button
                        key={bot.id}
                        type="button"
                        disabled={isAssigned}
                        onClick={() => {
                          void assignReviewerBot(session.id, bot.id);
                          setShowReviewerDropdown(false);
                        }}
                        className="w-full px-3 py-1.5 flex items-center justify-between text-left hover:bg-surface0 disabled:opacity-40 cursor-pointer rounded-sm"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="shrink-0">{bot.avatarEmoji}</span>
                          <div className="min-w-0 truncate">
                            <div className="text-xs font-medium text-text truncate">
                              {bot.name}
                            </div>
                            <div className="text-[10px] text-subtext0 truncate">{bot.tagline}</div>
                          </div>
                        </div>
                        {isAssigned && <Check className="w-3.5 h-3.5 text-accent shrink-0 ml-2" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Assigned Reviewers List */}
        {session.reviewers.length === 0 ? (
          <p className="text-xs text-subtext0 italic">No reviewers assigned</p>
        ) : (
          <div className="space-y-2">
            {session.reviewers.map((rev) => (
              <div
                key={rev.agentId}
                className="flex items-center justify-between gap-2 p-1.5 rounded-sm bg-surface0/40 border border-surface0/70"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <GitLabAvatar name={rev.agentName} isAiAgent={true} size="xs" />
                  <span className="text-xs font-medium text-text truncate">
                    {rev.agentName}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {renderReviewerStatusBadge(rev.reviewStatus)}
                  <button
                    type="button"
                    onClick={() => void removeReviewerBot(session.id, rev.agentId)}
                    className="p-1 text-subtext0 hover:text-red-400 cursor-pointer rounded-sm"
                    title={`Remove ${rev.agentName}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-b border-surface0/60" />

      {/* 3. LABELS */}
      <div ref={labelDropdownRef} className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-subtext0 uppercase tracking-wider">
            Labels
          </span>
          <button
            type="button"
            onClick={() => void toggleLabelDropdown()}
            className="text-xs text-primary hover:underline flex items-center gap-1 cursor-pointer rounded-sm"
            title="Edit labels"
          >
            <Plus className="w-3 h-3" />
            <span>Edit</span>
          </button>
        </div>

        {/* Labels Dropdown */}
        {showLabelDropdown && (
          <div className="relative z-50">
            <div className="rounded-sm bg-crust border border-surface0 shadow-xl py-1 my-1">
              <div className="px-3 py-1.5 flex items-center justify-between text-[11px] font-semibold text-subtext0 uppercase tracking-wider border-b border-surface0/60">
                <span>Assign Labels</span>
                <button
                  type="button"
                  onClick={() => {
                    setShowLabelDropdown(false);
                    openRepoSettings('labels');
                  }}
                  className="text-accent hover:underline text-[10px] lowercase rounded-sm cursor-pointer"
                >
                  manage
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto py-1">
                {isLoadingLabelOptions ? (
                  <div className="px-3 py-3 text-xs text-subtext0">Loading labels...</div>
                ) : repoLabels.length === 0 ? (
                  <div className="px-3 py-3 text-xs text-subtext0">No labels configured.</div>
                ) : (
                  repoLabels.map((lbl) => {
                    const isChecked = session.labels.some((l) => l.id === lbl.id);
                    return (
                      <button
                        key={lbl.id}
                        type="button"
                        onClick={() => void toggleSessionLabel(session.id, lbl.id)}
                        className="w-full px-3 py-1.5 flex items-center justify-between text-left hover:bg-surface0 cursor-pointer rounded-sm"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-sm shrink-0"
                            style={{ backgroundColor: lbl.color }}
                          />
                          <span className="text-xs text-text">{lbl.name}</span>
                        </div>
                        {isChecked && <Check className="w-3.5 h-3.5 text-accent" />}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* Assigned Labels List */}
        {session.labels.length === 0 ? (
          <p className="text-xs text-subtext0 italic">None</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {session.labels.map((lbl) => (
              <span
                key={lbl.id}
                className="px-2 py-0.5 rounded-sm text-[11px] font-medium text-white shadow-2xs flex items-center gap-1"
                style={{ backgroundColor: lbl.color }}
              >
                <span>{lbl.name}</span>
                <button
                  type="button"
                  onClick={() => void toggleSessionLabel(session.id, lbl.id)}
                  className="hover:opacity-75 cursor-pointer ml-0.5"
                  title={`Remove ${lbl.name}`}
                >
                  <X className="w-2.5 h-2.5 text-white" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="border-b border-surface0/60" />

      {/* 4. PARTICIPANTS */}
      <div className="space-y-2">
        <div className="text-[11px] font-semibold text-subtext0 uppercase tracking-wider">
          {participants.length} Participant{participants.length === 1 ? '' : 's'}
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {participants.map((p) => (
            <div
              key={p.id}
              className="relative cursor-pointer"
              title={`${p.name} (${p.roles.join(', ')})`}
            >
              <GitLabAvatar
                name={p.name}
                email={p.email}
                avatarUrl={p.avatarUrl}
                isAiAgent={p.isAiAgent}
                size="sm"
                className="hover:ring-2 hover:ring-primary transition-all rounded-full"
              />
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
};
