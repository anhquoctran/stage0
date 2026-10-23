import React,{ useEffect,useMemo,useRef,useState } from 'react';
import { useBotReviewersStore } from '../../ai/store/useBotReviewersStore';
import { useGitStore } from '../../git/store/useGitStore';
import { isReviewStartingForSession,useReviewStore } from '../../review/store/useReviewStore';
import { createStartMrReviewAction } from '../services/createStartMrReviewAction';
import { useVirtualMrStore } from '../store/useVirtualMrStore';
import { hasVirtualMrActivity } from '../utils/virtualMrActivity';
import { getMrSequenceNumber } from '../utils/virtualMrSequence';
import { VirtualMrCommitsTab } from './hub/VirtualMrCommitsTab';
import { VirtualMrHeader } from './hub/VirtualMrHeader';
import { VirtualMrMetadataBar } from './hub/VirtualMrMetadataBar';
import { VirtualMrOverviewTab } from './hub/VirtualMrOverviewTab';
import { useMrMetadataDropdowns } from './useMrMetadataDropdowns';

export const VirtualMrHub: React.FC = () => {
  const { currentRepo, showToast, diffPayload, branches, setBranchComparison } = useGitStore();
  const {
    sessions,
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
  }, [
    currentRepo?.id,
    repoSettings?.inheritGlobalAgents,
    getEffectiveReviewers,
    globalReviewers,
    repoActiveBotIds,
    repoCustomReviewers,
  ]);
  const activeReviewRuns = useReviewStore((state) => state.activeRuns);
  const isReviewStarting = useReviewStore((state) => state.isStarting);
  const reviewBatches = useReviewStore((state) => state.reviewBatches);

  const session = getActiveSession();
  const sequenceNumber = useMemo(() => {
    if (!session) return 1;
    return getMrSequenceNumber(sessions, session.id);
  }, [sessions, session?.id]);

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

  const [newGeneralComment, setNewGeneralComment] = useState('');
  const [isPostingDiscussion, setIsPostingDiscussion] = useState(false);
  const postingDiscussionRef = useRef(false);

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
  const reviewIsRunning = Object.values(activeReviewRuns).some(
    (run) => run.sessionId === session.id && run.status === 'running'
  );
  const isReviewOngoing = Boolean(reviewBatch) || reviewIsStarting || reviewIsRunning;
  const isBranchLocked = hasVirtualMrActivity(session, { isReviewOngoing });
  const branchLockedReason =
    'Cannot change branches once discussions or reviews have started in this Virtual MR';

  const handleStartAiReview = createStartMrReviewAction(session, showToast);

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
      showToast(
        `Could not post discussion: ${error instanceof Error ? error.message : String(error)}`,
        'error'
      );
    } finally {
      postingDiscussionRef.current = false;
      setIsPostingDiscussion(false);
    }
  };

  const handleBranchChange = async (sessionId: string, newBase: string, newCompare: string) => {
    if (isBranchLocked) {
      showToast(
        'Cannot change branches after discussions or reviews have started in this Virtual MR',
        'warning'
      );
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
      showToast(
        'Cannot change branches after discussions or reviews have started in this Virtual MR',
        'warning'
      );
      return;
    }
    await handleBranchChange(sessionId, currentCompare, currentBase);
  };

  return (
    <div className="border-b border-surface0 bg-mantle text-text text-xs">
      {/* TOP HEADER: TITLE & STATUS & ACTIONS */}
      <VirtualMrHeader
        session={session}
        sequenceNumber={sequenceNumber}
        isEditingTitle={isEditingTitle}
        editTitle={editTitle}
        setEditTitle={setEditTitle}
        handleSaveTitle={handleSaveTitle}
        setIsEditingTitle={setIsEditingTitle}
        handleStartEditTitle={handleStartEditTitle}
        isBranchLocked={isBranchLocked}
        branchLockedReason={branchLockedReason}
        branches={branches}
        handleBranchChange={handleBranchChange}
        handleSwapBranches={handleSwapBranches}
        hasAssignedReviewer={hasAssignedReviewer}
        reviewBatch={reviewBatch}
        reviewIsStarting={reviewIsStarting}
        reviewIsRunning={reviewIsRunning}
        handleStartAiReview={handleStartAiReview}
      />

      {/* METADATA BAR: ASSIGNEE, REVIEWERS, LABELS */}
      <VirtualMrMetadataBar
        session={session}
        removeReviewerBot={removeReviewerBot}
        toggleReviewerDropdown={toggleReviewerDropdown}
        showReviewerDropdown={showReviewerDropdown}
        isLoadingReviewerOptions={isLoadingReviewerOptions}
        effectiveReviewers={effectiveReviewers}
        assignReviewerBot={assignReviewerBot}
        setShowReviewerDropdown={setShowReviewerDropdown}
        toggleLabelDropdown={toggleLabelDropdown}
        showLabelDropdown={showLabelDropdown}
        setShowLabelDropdown={setShowLabelDropdown}
        openRepoSettings={openRepoSettings}
        isLoadingLabelOptions={isLoadingLabelOptions}
        repoLabels={repoLabels}
        toggleSessionLabel={toggleSessionLabel}
        setActiveMrTab={setActiveMrTab}
        activeMrTab={activeMrTab}
        diffPayload={diffPayload}
      />

      {/* EXPANDABLE TAB CONTENT: OVERVIEW & COMMITS */}
      {activeMrTab === 'overview' && (
        <VirtualMrOverviewTab
          isEditingDesc={isEditingDesc}
          setIsEditingDesc={setIsEditingDesc}
          session={session}
          descValue={descValue}
          setDescValue={setDescValue}
          handleGenerateDescription={handleGenerateDescription}
          handleSaveDesc={handleSaveDesc}
          newGeneralComment={newGeneralComment}
          setNewGeneralComment={setNewGeneralComment}
          handleAddGeneralComment={handleAddGeneralComment}
          isPostingDiscussion={isPostingDiscussion}
        />
      )}

      {/* EXPANDABLE TAB CONTENT: COMMITS */}
      {activeMrTab === 'commits' && <VirtualMrCommitsTab session={session} />}
    </div>
  );
};
