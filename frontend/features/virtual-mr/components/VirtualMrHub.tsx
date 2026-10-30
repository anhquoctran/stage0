import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBotReviewersStore } from '../../ai/store/useBotReviewersStore';
import { useGitStore } from '../../git/store/useGitStore';
import { isReviewStartingForSession, useReviewStore } from '../../review/store/useReviewStore';
import { useVirtualMrStore } from '../store/useVirtualMrStore';
import { hasVirtualMrActivity } from '../utils/virtualMrActivity';
import { getMrSequenceNumber } from '../utils/virtualMrSequence';
import { VirtualMrHeader } from './hub/VirtualMrHeader';
import { VirtualMrMetadataBar } from './hub/VirtualMrMetadataBar';
import { useMrMetadataDropdowns } from './useMrMetadataDropdowns';

export const VirtualMrHub: React.FC = () => {
  const { t } = useTranslation();
  const { currentRepo, showToast, diffPayload, branches, setBranchComparison } = useGitStore();
  const {
    sessions,
    getActiveSession,
    updateSessionDetails,
    updateSessionBranches,
    assignReviewerBot,
    removeReviewerBot,
    toggleSessionLabel,
    repoLabels,
    activeMrTab,
    setActiveMrTab,
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

  useEffect(() => {
    if (!session) return;
    setEditTitle(session.title);
  }, [session?.id, session?.title]);

  if (!currentRepo || !session) return null;

  const reviewBatch = reviewBatches[session.id];
  const reviewIsStarting = isReviewStarting && isReviewStartingForSession(session.id);
  const reviewIsRunning = Object.values(activeReviewRuns).some(
    (run) => run.sessionId === session.id && run.status === 'running'
  );
  const isReviewOngoing = Boolean(reviewBatch) || reviewIsStarting || reviewIsRunning;
  const isBranchLocked = hasVirtualMrActivity(session, { isReviewOngoing });
  const branchLockedReason =
    t('virtualMr.toasts.branchesLocked');

  const handleStartEditTitle = () => {
    setEditTitle(session.title);
    setIsEditingTitle(true);
  };

  const handleSaveTitle = async () => {
    if (!editTitle.trim()) return;
    await updateSessionDetails(session.id, editTitle.trim(), session.description);
    setIsEditingTitle(false);
    showToast(t('virtualMr.toasts.titleUpdated'));
  };

  const handleBranchChange = async (sessionId: string, newBase: string, newCompare: string) => {
    if (isBranchLocked) {
      showToast(
        t('virtualMr.toasts.branchesLocked'),
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
        t('virtualMr.toasts.branchesLocked'),
        'warning'
      );
      return;
    }
    await handleBranchChange(sessionId, currentCompare, currentBase);
  };

  return (
    <div className="border-b border-surface0 bg-mantle text-text text-xs shrink-0">
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
      />

      {/* METADATA BAR: ASSIGNEE, REVIEWERS, LABELS, 4 WORKSPACE TABS */}
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
    </div>
  );
};
