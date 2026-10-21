import React, { useState, useEffect, useMemo, useRef } from 'react';
import { CheckCircle2 } from '../../../common/components/icons/CheckCircle2';
import { XCircle } from '@/common/components/icons';
import { Bot } from '../../../common/components/icons/Bot';
import { User } from '../../../common/components/icons/User';
import { Plus } from '../../../common/components/icons/Plus';
import { Edit2 } from '../../../common/components/icons/Edit2';
import { Check } from '../../../common/components/icons/Check';
import { X } from '../../../common/components/icons/X';
import { FileCode } from '../../../common/components/icons/FileCode';
import { GitCommit } from '../../../common/components/icons/GitCommit';
import { MessageSquare } from '../../../common/components/icons/MessageSquare';
import { RefreshCw } from '../../../common/components/icons/RefreshCw';
import { ArrowRight } from '../../../common/components/icons/ArrowRight';
import { Lock } from '../../../common/components/icons/Lock';
import { formatDateTime } from '@/common/utils/dateTime';
import { useVirtualMrStore } from '../store/useVirtualMrStore';
import { useGitStore } from '../../git/store/useGitStore';
import { useBotReviewersStore } from '../../ai/store/useBotReviewersStore';
import { type BotReviewer } from '../types/BotReviewer';
import { MarkdownEditor } from '../../../common/components/MarkdownEditor';
import { MarkdownPreview } from '../../../common/components/MarkdownPreview';
import { TabBranchSelector } from '../../git/components/TabBranchSelector';
import { isReviewStartingForSession, useReviewStore } from '../../review/store/useReviewStore';
import { startAssignedReviewBatchForSession } from '../../review/services/assignedReviewService';
import { MrDiscussionBoard } from './MrDiscussionBoard';
import { getDiscussionMentionOptions } from '../utils/discussionMentions';
import { hasVirtualMrActivity } from '../utils/virtualMrActivity';

export const VirtualMrHub: React.FC = () => {
  const { currentRepo, showToast, diffPayload, branches, setBranchComparison } = useGitStore();
  const {
    getActiveSession,
    consumeDescriptionEditRequest,
    updateSessionDetails,
    updateSessionBranches,
    assignReviewerBot,
    removeReviewerBot,
    toggleSessionLabel,
    repoLabels,
    activeMrTab,
    setActiveMrTab,
    createDiscussion,
    openRepoSettings,
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
  }, [currentRepo?.id, repoSettings?.inheritGlobalAgents, getEffectiveReviewers, globalReviewers, repoActiveBotIds, repoCustomReviewers]);
  const activeReviewRuns = useReviewStore((state) => state.activeRuns);
  const isReviewStarting = useReviewStore((state) => state.isStarting);
  const reviewBatches = useReviewStore((state) => state.reviewBatches);

  const session = getActiveSession();

  // Title inline edit
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');

  const isLegacyBoilerplate = (desc?: string) =>
    Boolean(
      desc &&
      desc.includes('Virtual MR comparing') &&
      (desc.includes('Review code changes') || desc.includes('Check security'))
    );

  // Existing MRs open in preview. New MRs request the editor once after creation.
  const [descValue, setDescValue] = useState(() => {
    const raw = session?.description || '';
    return isLegacyBoilerplate(raw) ? '' : raw;
  });
  const [isEditingDesc, setIsEditingDesc] = useState(false);

  // Dropdown states
  const [showReviewerDropdown, setShowReviewerDropdown] = useState(false);
  const [showLabelDropdown, setShowLabelDropdown] = useState(false);
  const [isLoadingReviewerOptions, setIsLoadingReviewerOptions] = useState(false);
  const [isLoadingLabelOptions, setIsLoadingLabelOptions] = useState(false);
  const [newGeneralComment, setNewGeneralComment] = useState('');
  const [isPostingDiscussion, setIsPostingDiscussion] = useState(false);
  const postingDiscussionRef = useRef(false);

  const toggleReviewerDropdown = async () => {
    const willOpen = !showReviewerDropdown;
    setShowReviewerDropdown(willOpen);
    if (!willOpen) return;

    reloadPersistedReviewers();
    if (!currentRepo?.id) return;
    setIsLoadingReviewerOptions(true);
    try {
      await refreshRepoMetadata(currentRepo.id);
    } finally {
      setIsLoadingReviewerOptions(false);
    }
  };

  const toggleLabelDropdown = async () => {
    const willOpen = !showLabelDropdown;
    setShowLabelDropdown(willOpen);
    if (!willOpen || !currentRepo?.id) return;

    setIsLoadingLabelOptions(true);
    try {
      await refreshRepoMetadata(currentRepo.id);
    } finally {
      setIsLoadingLabelOptions(false);
    }
  };

  useEffect(() => {
    if (!session) return;
    setEditTitle(session.title);
    setIsEditingDesc(consumeDescriptionEditRequest(session.id));
  }, [session?.id, consumeDescriptionEditRequest]);

  useEffect(() => {
    if (!session) return;
    if (isLegacyBoilerplate(session.description)) {
      updateSessionDetails(session.id, session.title, '');
      setDescValue('');
    } else {
      setDescValue(session.description || '');
    }
  }, [session?.id, session?.description]);

  if (!currentRepo || !session) return null;
  const hasAssignedReviewer = session.reviewers.length > 0;
  const reviewBatch = reviewBatches[session.id];
  const reviewIsStarting = isReviewStarting && isReviewStartingForSession(session.id);
  const reviewIsRunning = Object.values(activeReviewRuns).some((run) => run.sessionId === session.id && run.status === 'running');
  const isReviewOngoing = Boolean(reviewBatch) || reviewIsStarting || reviewIsRunning;
  const isBranchLocked = hasVirtualMrActivity(session, { isReviewOngoing });
  const branchLockedReason = 'Cannot change branches once discussions or reviews have started in this Virtual MR';

  const handleStartAiReview = async () => {
    try {
      const result = await startAssignedReviewBatchForSession(session.id);
      if (!result.runs.length && !result.failures.length) {
        showToast('No assigned AI reviewer is available for this Virtual MR.', 'warning');
        return;
      }
      const completed = result.runs.filter((run) => run.status === 'completed' || run.status === 'partial').length;
      const summary = `${completed}/${session.reviewers.length} reviewers finished.`;
      if (result.failures.length) {
        showToast(`AI review ${completed ? 'incomplete' : 'failed'}. ${summary} ${[result.failures[0], !result.descriptionGenerated ? 'The MR description was not updated.' : 'The MR description was saved.'].join(' ')}`, completed ? 'warning' : 'error');
      } else if (!result.descriptionGenerated) {
        showToast(result.hasChanges ? `${summary} The MR description could not be generated from the available diff.` : 'No changed files were found in this Virtual MR snapshot.', result.hasChanges ? 'warning' : 'info');
      } else {
        const partial = result.runs.some((run) => run.status === 'partial');
        showToast(`AI review ${partial ? 'finished with incomplete coverage' : 'completed'}. ${summary} The MR description was updated.`, partial ? 'warning' : 'success');
      }
    } catch (error) {
      showToast(`AI code review could not start: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  };

  const handleStartEditTitle = () => {
    setEditTitle(session.title);
    setIsEditingTitle(true);
  };

  const handleSaveTitle = async () => {
    if (!editTitle.trim()) return;
    await updateSessionDetails(session.id, editTitle.trim(), session.description);
    setIsEditingTitle(false);
    showToast('Title updated');
  };

  const handleSaveDesc = async () => {
    await updateSessionDetails(session.id, session.title, descValue);
    showToast('Description saved');
    setIsEditingDesc(false);
  };

  const handleGenerateDescription = () => {
    if (!session) return;
    setIsEditingDesc(true);
    const commitList =
      session.commits.length > 0
        ? session.commits.map((c) => `- ${c.subject} (\`${c.shortHash}\`)`).join('\n')
        : '- Ongoing changes between branches';

    const draft = `## Summary\nAutomated overview for \`${session.compareBranch}\` → \`${session.baseBranch}\`.\n\n### Key Changes\n${commitList}\n\n### Testing & Verification\n- [ ] AI review checks verified\n- [ ] Local build & tests pass\n`;

    if (descValue.trim() && descValue.trim() !== draft.trim()) {
      if (window.confirm('Replace current description with a draft from commit metadata?')) {
        setDescValue(draft);
        showToast('Generated description from commit metadata. No AI request was sent.');
      }
    } else {
      setDescValue(draft);
      showToast('Generated description from commit metadata. No AI request was sent.');
    }
  };

  const handleAddGeneralComment = async () => {
    if (!newGeneralComment.trim() || postingDiscussionRef.current) return;
    postingDiscussionRef.current = true;
    setIsPostingDiscussion(true);
    try {
      await createDiscussion(session.id, { initialComment: newGeneralComment.trim() });
      setNewGeneralComment('');
      showToast('Discussion posted', 'success');
    } catch (error) {
      showToast(`Could not post discussion: ${error instanceof Error ? error.message : String(error)}`, 'error');
    } finally {
      postingDiscussionRef.current = false;
      setIsPostingDiscussion(false);
    }
  };

  const handleBranchChange = async (
    sessionId: string,
    newBase: string,
    newCompare: string
  ) => {
    if (isBranchLocked) {
      showToast('Cannot change branches after discussions or reviews have started in this Virtual MR', 'warning');
      return;
    }
    await updateSessionBranches(sessionId, newBase, newCompare);
    await setBranchComparison(newBase, newCompare);
  };

  const handleSwapBranches = async (
    sessionId: string,
    currentBase: string,
    currentCompare: string
  ) => {
    if (isBranchLocked) {
      showToast('Cannot change branches after discussions or reviews have started in this Virtual MR', 'warning');
      return;
    }
    await handleBranchChange(sessionId, currentCompare, currentBase);
  };

  return (
    <div className="border-b border-surface0 bg-mantle text-text text-xs">
      {/* TOP HEADER: TITLE & STATUS & ACTIONS */}
      <div className="px-4 py-2.5 flex items-center justify-between gap-4 border-b border-surface0/60 bg-crust/30">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Read-only MR Status Badge */}
          {session.status === 'resolved' ? (
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 select-none shadow-xs shrink-0"
              title="All reviewers approved and all discussions are resolved"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Resolved</span>
            </div>
          ) : session.status === 'closed' ? (
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1  text-xs font-semibold bg-surface1/80 border border-surface2 text-subtext0 select-none shadow-xs shrink-0"
              title="Virtual MR is Closed"
            >
              <XCircle className="w-3.5 h-3.5 text-subtext1 shrink-0" />
              <span>Closed</span>
            </div>
          ) : (
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1  text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 select-none shadow-xs shrink-0"
              title="Virtual MR is Open"
            >
              <span className="w-2 h-2  bg-emerald-400 animate-pulse shrink-0" />
              <span>Open</span>
            </div>
          )}

          {/* Title */}
          {isEditingTitle ? (
            <div className="flex items-center gap-2 flex-1">
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveTitle();
                  if (e.key === 'Escape') setIsEditingTitle(false);
                }}
                className="flex-1 px-2.5 py-1  bg-surface0 border border-surface1 text-text text-sm font-semibold focus:outline-none"
                autoFocus
              />
              <button
                type="button"
                onClick={handleSaveTitle}
                className="p-1  bg-brand hover:bg-brand/90 text-on-accent cursor-pointer shadow-xs"
                title="Save"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsEditingTitle(false)}
                className="p-1  bg-surface1 hover:bg-surface2 text-white cursor-pointer"
                title="Cancel"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-sm font-semibold text-text truncate max-w-xs">{session.title}</h1>
              <button
                type="button"
                onClick={handleStartEditTitle}
                className="p-1  bg-surface1 hover:bg-surface2 text-white cursor-pointer"
                title="Edit title"
              >
                <Edit2 className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
          )}

          {/* Branch Selector for Active Virtual MR */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 border shrink-0 transition-colors ${
              isBranchLocked
                ? 'bg-surface0/30 border-surface0/50'
                : 'bg-surface0/60 border-surface1/60'
            }`}
            title={isBranchLocked ? branchLockedReason : undefined}
          >
            <div className="flex items-center gap-1 mr-0.5">
              {isBranchLocked && (
                <Lock
                  className="w-3 h-3 text-subtext0 shrink-0"
                  title={branchLockedReason}
                />
              )}
              <span className="text-[10px] text-subtext0 uppercase font-mono tracking-wider font-semibold">
                Branch:
              </span>
            </div>
            <TabBranchSelector
              roleType="source"
              disabled={isBranchLocked}
              title={isBranchLocked ? branchLockedReason : undefined}
              value={session.compareBranch}
              branches={branches}
              onChange={(branch) => handleBranchChange(session.id, session.baseBranch, branch)}
            />
            <button
              type="button"
              onClick={() => handleSwapBranches(session.id, session.baseBranch, session.compareBranch)}
              disabled={isBranchLocked}
              title={isBranchLocked ? branchLockedReason : "Swap Compare and Base branches"}
              className={`p-1 border border-transparent transition-colors ${
                isBranchLocked
                  ? 'text-subtext0/30 cursor-not-allowed'
                  : 'text-subtext0 hover:text-brand hover:bg-surface0 hover:border-surface0 cursor-pointer'
              }`}
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <TabBranchSelector
              roleType="target"
              disabled={isBranchLocked}
              title={isBranchLocked ? branchLockedReason : undefined}
              value={session.baseBranch}
              branches={branches}
              onChange={(branch) => handleBranchChange(session.id, branch, session.compareBranch)}
            />
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={!hasAssignedReviewer || Boolean(reviewBatch) || reviewIsStarting || reviewIsRunning}
            onClick={() => void handleStartAiReview()}
            title={!hasAssignedReviewer ? "Add an AI bot to the Reviewers list to start a review" : reviewBatch ? `Reviewing ${reviewBatch.reviewerName} (${reviewBatch.current}/${reviewBatch.total})` : reviewIsRunning ? "An AI code review is already running" : "Start a review with every assigned AI reviewer"}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white transition-colors font-medium text-xs cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-white ${reviewIsRunning ? 'animate-spin' : ''}`} />
            <span className="text-white">
              {reviewBatch
                ? reviewBatch.phase === 'preparing-description'
                  ? `Summarizing MR · ${reviewBatch.current}/${reviewBatch.total}`
                  : `Reviewing ${reviewBatch.reviewerName} · ${reviewBatch.current}/${reviewBatch.total}`
                : reviewIsStarting ? 'Starting review…' : reviewIsRunning ? 'Review running…' : 'AI code review'}
            </span>
          </button>
        </div>
      </div>

      {/* METADATA BAR: ASSIGNEE, REVIEWERS, LABELS */}
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
                ) : effectiveReviewers.map((bot: BotReviewer) => {
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
                })}
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
                  ) : repoLabels.map((lbl) => {
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
                  })}
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
              activeMrTab === 'overview' ? 'bg-surface2 text-white font-medium shadow-2xs' : 'bg-surface0 text-white/80 hover:text-white hover:bg-surface1'
            }`}
          >
            <MessageSquare className="w-3 h-3 text-white" />
            <span>Overview ({session.discussions.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMrTab('commits')}
            className={`px-3 py-1 text-xs transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeMrTab === 'commits' ? 'bg-surface2 text-white font-medium shadow-2xs' : 'bg-surface0 text-white/80 hover:text-white hover:bg-surface1'
            }`}
          >
            <GitCommit className="w-3 h-3 text-white" />
            <span>Commits ({session.commits.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMrTab('diff')}
            className={`px-3 py-1 text-xs transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeMrTab === 'diff' ? 'bg-surface2 text-white font-medium shadow-2xs' : 'bg-surface0 text-white/80 hover:text-white hover:bg-surface1'
            }`}
          >
            <FileCode className="w-3 h-3 text-white" />
            <span>Files Changed ({diffPayload?.files.length || 0})</span>
          </button>
        </div>
      </div>

      {/* EXPANDABLE TAB CONTENT: OVERVIEW & COMMITS */}
      {activeMrTab === 'overview' && (
        <div className="p-4 bg-crust/50 border-b border-surface0 space-y-4 max-h-80 overflow-y-auto">
          {/* Description Section */}
          <div className="p-3.5  bg-mantle border border-surface0 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-subtext1">Description</span>
              {!isEditingDesc ? (
                <button
                  type="button"
                  onClick={() => setIsEditingDesc(true)}
                  className="text-[11px] text-accent hover:underline cursor-pointer"
                >
                  Edit Markdown
                </button>
              ) : session.description ? (
                <button
                  type="button"
                  onClick={() => setIsEditingDesc(false)}
                  className="text-[11px] text-subtext0 hover:text-text cursor-pointer"
                >
                  Preview
                </button>
              ) : null}
            </div>
            {isEditingDesc ? (
              <div className="space-y-2">
                <MarkdownEditor
                  value={descValue}
                  onChange={setDescValue}
                  placeholder="Enter description here..."
                  rows={4}
                  minHeight="110px"
                  showActions={true}
                  onGenerateDraft={handleGenerateDescription}
                  onSubmit={handleSaveDesc}
                  submitLabel="Save Description"
                  onCancel={() => {
                    setDescValue(session.description);
                    setIsEditingDesc(false);
                  }}
                  cancelLabel="Cancel"
                />
              </div>
            ) : (
              <div className="p-3 bg-surface0/30 border border-surface0/60 leading-relaxed">
                <MarkdownPreview
                  content={session.description}
                  emptyPlaceholder="No description provided for this Virtual MR."
                />
              </div>
            )}
          </div>

          {/* General Discussions Timeline */}
          <div className="space-y-3">
            <MrDiscussionBoard session={session} />

            {/* Add general comment */}
            <div className="space-y-1.5 pt-1">
              <MarkdownEditor
                value={newGeneralComment}
                mentionOptions={getDiscussionMentionOptions(session)}
                onChange={setNewGeneralComment}
                placeholder="Write your comment here to start discussion..."
                rows={3}
                minHeight="80px"
                showActions={true}
                onSubmit={handleAddGeneralComment}
                submitLabel="Post Comment"
                disabled={isPostingDiscussion}
                isSubmitting={isPostingDiscussion}
              />
            </div>
          </div>
        </div>
      )}

      {/* EXPANDABLE TAB CONTENT: COMMITS */}
      {activeMrTab === 'commits' && (
        <div className="p-4 bg-crust/50 border-b border-surface0 max-h-72 overflow-y-auto space-y-2">
          {session.commits.length === 0 ? (
            <div className="p-6 text-center text-subtext0 text-xs">
              No commits unique to {session.compareBranch} relative to {session.baseBranch}.
            </div>
          ) : (
            session.commits.map((c) => (
              <div
                key={c.hash}
                className="p-3  bg-mantle border border-surface0 flex items-center justify-between gap-4"
              >
                <div className="space-y-1 min-w-0">
                  <div className="font-medium text-xs text-text truncate">{c.subject}</div>
                  <div className="flex items-center gap-3 text-[11px] text-subtext0 font-mono">
                    <span className="text-accent">{c.authorName}</span>
                    <span>{formatDateTime(c.authoredDate)}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="px-2 py-0.5  bg-surface0 font-mono text-[11px] text-subtext0">
                    {c.shortHash}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
