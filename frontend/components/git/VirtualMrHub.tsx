import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  Bot,
  User,
  Plus,
  Edit2,
  Check,
  X,
  FileCode,
  GitCommit,
  MessageSquare,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';
import { useVirtualMrStore } from '../../store/useVirtualMrStore';
import { useGitStore } from '../../store/useGitStore';
import { AVAILABLE_AI_BOTS } from '../../types/virtualMr';
import { MarkdownEditor } from '../common/MarkdownEditor';
import { MarkdownPreview } from '../common/MarkdownPreview';
import { TabBranchSelector } from '../git/TabBranchSelector';

export const VirtualMrHub: React.FC = () => {
  const { currentRepo, showToast, diffPayload, branches, setBaseBranch, setCompareBranch } = useGitStore();
  const {
    getActiveSession,
    updateSessionDetails,
    updateSessionBranches,
    assignReviewerBot,
    removeReviewerBot,
    toggleSessionLabel,
    repoLabels,
    activeMrTab,
    setActiveMrTab,
    createDiscussion,
    triggerIncrementalReReview,
    openRepoSettings,
  } = useVirtualMrStore();

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

  // Description inline edit - default enabled to allow entering content immediately
  const [descValue, setDescValue] = useState(() => {
    const raw = session?.description || '';
    return isLegacyBoilerplate(raw) ? '' : raw;
  });
  const [isEditingDesc, setIsEditingDesc] = useState(true);

  // Dropdown states
  const [showReviewerDropdown, setShowReviewerDropdown] = useState(false);
  const [showLabelDropdown, setShowLabelDropdown] = useState(false);
  const [newGeneralComment, setNewGeneralComment] = useState('');
  const [isVerifyingAll, setIsVerifyingAll] = useState(false);

  useEffect(() => {
    if (session) {
      setEditTitle(session.title);
      if (isLegacyBoilerplate(session.description)) {
        updateSessionDetails(session.id, session.title, '');
        setDescValue('');
      } else {
        setDescValue(session.description || '');
      }
      setIsEditingDesc(true);
    }
  }, [session?.id, session?.description]);

  if (!currentRepo || !session) return null;

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
    if (descValue.trim()) {
      setIsEditingDesc(false);
    }
  };

  const handleAiGenerateDescription = () => {
    if (!session) return;
    setIsEditingDesc(true);
    const commitList =
      session.commits.length > 0
        ? session.commits.map((c) => `- ${c.subject} (\`${c.shortHash}\`)`).join('\n')
        : '- Ongoing changes between branches';

    const draft = `## Summary\nAutomated overview for \`${session.compareBranch}\` → \`${session.baseBranch}\`.\n\n### Key Changes\n${commitList}\n\n### Testing & Verification\n- [ ] AI review checks verified\n- [ ] Local build & tests pass\n`;

    if (descValue.trim() && descValue.trim() !== draft.trim()) {
      if (window.confirm('Replace current description with AI generated draft?')) {
        setDescValue(draft);
        showToast('Generated description with AI draft');
      }
    } else {
      setDescValue(draft);
      showToast('Generated description with AI draft');
    }
  };

  const handleAddGeneralComment = async () => {
    if (!newGeneralComment.trim()) return;
    await createDiscussion(session.id, {
      initialComment: newGeneralComment.trim(),
    });
    setNewGeneralComment('');
    showToast('Comment posted');
  };

  const handleTriggerReReview = async () => {
    setIsVerifyingAll(true);
    showToast('Requesting AI Bots re-verification...');
    try {
      await triggerIncrementalReReview(session.id);
      showToast('Re-verification completed');
    } finally {
      setIsVerifyingAll(false);
    }
  };

  const handleBranchChange = async (
    sessionId: string,
    newBase: string,
    newCompare: string
  ) => {
    await updateSessionBranches(sessionId, newBase, newCompare);
    await setBaseBranch(newBase);
    await setCompareBranch(newCompare);
  };

  const handleSwapBranches = async (
    sessionId: string,
    currentBase: string,
    currentCompare: string
  ) => {
    await handleBranchChange(sessionId, currentCompare, currentBase);
  };

  return (
    <div className="border-b border-surface0 bg-mantle text-text text-xs">
      {/* TOP HEADER: TITLE & STATUS & ACTIONS */}
      <div className="px-4 py-2.5 flex items-center justify-between gap-4 border-b border-surface0/60 bg-crust/30">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Read-only MR Status Badge */}
          {session.status === 'approved' ? (
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/15 border border-purple-500/30 text-purple-300 select-none shadow-xs shrink-0"
              title="Approved by AI Reviewer"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span>Approved by AI</span>
            </div>
          ) : session.status === 'closed' ? (
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-surface1/80 border border-surface2 text-subtext0 select-none shadow-xs shrink-0"
              title="Virtual MR is Closed"
            >
              <XCircle className="w-3.5 h-3.5 text-subtext1 shrink-0" />
              <span>Closed</span>
            </div>
          ) : (
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 select-none shadow-xs shrink-0"
              title="Virtual MR is Open"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
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
                className="flex-1 px-2.5 py-1 rounded bg-surface0 border border-surface1 text-text text-sm font-semibold focus:outline-none"
                autoFocus
              />
              <button
                type="button"
                onClick={handleSaveTitle}
                className="p-1 rounded bg-brand hover:bg-brand/90 text-[#11111b] cursor-pointer shadow-xs"
                title="Save"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsEditingTitle(false)}
                className="p-1 rounded bg-surface1 hover:bg-surface2 text-white cursor-pointer"
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
                className="p-1 rounded bg-surface1 hover:bg-surface2 text-white cursor-pointer"
                title="Edit title"
              >
                <Edit2 className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
          )}

          {/* Branch Selector for Active Virtual MR */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface0/60 border border-surface1/60 shrink-0">
            <span className="text-[10px] text-subtext0 uppercase font-mono tracking-wider font-semibold mr-0.5">Branch:</span>
            <TabBranchSelector
              roleType="source"
              value={session.compareBranch}
              branches={branches}
              onChange={(branch) => handleBranchChange(session.id, session.baseBranch, branch)}
            />
            <button
              type="button"
              onClick={() => handleSwapBranches(session.id, session.baseBranch, session.compareBranch)}
              title="Swap Compare and Base branches"
              className="p-1 text-subtext0 hover:text-brand hover:bg-surface0 border border-transparent hover:border-surface0 transition-colors cursor-pointer"
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <TabBranchSelector
              roleType="target"
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
            onClick={handleTriggerReReview}
            disabled={isVerifyingAll}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white transition-colors font-medium text-xs cursor-pointer shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-white ${isVerifyingAll ? 'animate-spin' : ''}`} />
            <span className="text-white">Re-verify with AI</span>
          </button>
        </div>
      </div>

      {/* METADATA BAR: ASSIGNEE, REVIEWERS, LABELS */}
      <div className="px-4 py-2 flex items-center justify-between gap-4 bg-mantle text-xs border-b border-surface0/40">
        <div className="flex items-center gap-6 flex-wrap">
          {/* Assignee */}
          <div className="flex items-center gap-2">
            <span className="text-subtext0">Assignee:</span>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-surface0 font-medium">
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
                  className="flex items-center gap-1 px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[11px]"
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
                onClick={() => setShowReviewerDropdown(!showReviewerDropdown)}
                className="p-1 rounded bg-surface1 hover:bg-surface2 text-white cursor-pointer"
                title="Add AI Reviewer Bot"
              >
                <Plus className="w-3 h-3 text-white" />
              </button>
            </div>

            {/* Reviewer Dropdown */}
            {showReviewerDropdown && (
              <div className="absolute top-full left-16 mt-1 w-60 rounded-lg bg-crust border border-surface0 shadow-xl py-1 z-50">
                <div className="px-3 py-1.5 text-[11px] font-semibold text-subtext0 uppercase tracking-wider">
                  Select AI Reviewer Bot
                </div>
                {AVAILABLE_AI_BOTS.map((bot) => {
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
                  className="px-2 py-0.5 rounded-full text-[10px] font-medium text-white shadow-2xs"
                  style={{ backgroundColor: lbl.color }}
                >
                  {lbl.name}
                </span>
              ))}
              <button
                type="button"
                onClick={() => setShowLabelDropdown(!showLabelDropdown)}
                className="p-1 rounded bg-surface1 hover:bg-surface2 text-white cursor-pointer"
                title="Manage Labels"
              >
                <Plus className="w-3 h-3 text-white" />
              </button>
            </div>

            {/* Label Dropdown */}
            {showLabelDropdown && (
              <div className="absolute top-full left-14 mt-1 w-56 rounded-lg bg-crust border border-surface0 shadow-xl py-1 z-50">
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
                  {repoLabels.map((lbl) => {
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
                            className="w-2.5 h-2.5 rounded-full shrink-0"
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
          <div className="p-3.5 rounded-lg bg-mantle border border-surface0 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-subtext1">Description</span>
              {session.description && !isEditingDesc ? (
                <button
                  type="button"
                  onClick={() => setIsEditingDesc(true)}
                  className="text-[11px] text-accent hover:underline cursor-pointer"
                >
                  Edit Markdown
                </button>
              ) : session.description && isEditingDesc ? (
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
                  onAiGenerate={handleAiGenerateDescription}
                  onSubmit={handleSaveDesc}
                  submitLabel="Save Description"
                  onCancel={session.description ? () => {
                    setDescValue(session.description);
                    setIsEditingDesc(false);
                  } : undefined}
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
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-text">
                General Discussions ({session.discussions.filter((d) => !d.filePath).length})
              </span>
            </div>

            {/* General comments list */}
            {session.discussions
              .filter((d) => !d.filePath)
              .map((disc) => (
                <div key={disc.id} className="p-3 rounded-lg bg-mantle border border-surface0 space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-subtext0">
                    <span className="font-medium text-text">{disc.comments[0]?.authorName}</span>
                    <span>{disc.createdAt ? new Date(disc.createdAt).toLocaleTimeString() : ''}</span>
                  </div>
                  <div className="text-xs text-text pl-1">
                    <MarkdownPreview content={disc.comments[0]?.body} />
                  </div>
                  
                  {/* Replies */}
                  {disc.comments.slice(1).map((rep) => (
                    <div key={rep.id} className="ml-4 pl-3 border-l-2 border-surface0 py-1 space-y-1">
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="font-medium text-text">{rep.authorName}</span>
                        <span className="text-subtext0">{new Date(rep.createdAt).toLocaleTimeString()}</span>
                      </div>
                      <div className="text-xs text-text pl-1">
                        <MarkdownPreview content={rep.body} />
                      </div>
                    </div>
                  ))}
                </div>
              ))}

            {/* Add general comment */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-semibold text-subtext0 block">
                MR Discussion
              </span>
              <MarkdownEditor
                value={newGeneralComment}
                onChange={setNewGeneralComment}
                placeholder="Write your comment here to start discussion..."
                rows={3}
                minHeight="80px"
                showActions={true}
                onSubmit={handleAddGeneralComment}
                submitLabel="Post Comment"
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
              No commits found between {session.compareBranch} and {session.baseBranch}.
            </div>
          ) : (
            session.commits.map((c) => (
              <div
                key={c.hash}
                className="p-3 rounded-lg bg-mantle border border-surface0 flex items-center justify-between gap-4"
              >
                <div className="space-y-1 min-w-0">
                  <div className="font-medium text-xs text-text truncate">{c.subject}</div>
                  <div className="flex items-center gap-3 text-[11px] text-subtext0 font-mono">
                    <span className="text-accent">{c.authorName}</span>
                    <span>{new Date(c.authoredDate).toLocaleString()}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="px-2 py-0.5 rounded bg-surface0 font-mono text-[11px] text-subtext0">
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
