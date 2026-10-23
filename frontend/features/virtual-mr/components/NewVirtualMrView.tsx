import React, { useMemo, useState } from 'react';
import { GitBranch } from '../../../common/components/icons/GitBranch';
import { Loader2 } from '../../../common/components/icons/Loader2';
import { useBotReviewersStore } from '../../ai/store/useBotReviewersStore';
import { useGitStore } from '../../git/store/useGitStore';
import { startNewMrReviewBatch } from '../services/startNewMrReviewBatch';
import { useVirtualMrStore } from '../store/useVirtualMrStore';
import { createNewMrDescriptionDraft } from '../utils/createNewMrDescriptionDraft';
import { NewVirtualMrComparisonError } from './new-mr/NewVirtualMrComparisonError';
import { NewVirtualMrFormSection } from './new-mr/NewVirtualMrFormSection';
import { NewVirtualMrHeader } from './new-mr/NewVirtualMrHeader';
import { NewVirtualMrPreview } from './new-mr/NewVirtualMrPreview';
import { useNewMrMetadata } from './useNewMrMetadata';

export const NewVirtualMrView: React.FC = () => {
  const {
    draftMr,
    updateDraftMr,
    changeDraftBranches,
    closeNewMrDraft,
    submitNewMrDraft,
    repoLabels,
    createRepoLabel,
    repoSettings,
    refreshRepoMetadata,
  } = useVirtualMrStore();

  const {
    currentRepo,
    branches,
    diffPayload,
    diffError,
    conflictCheckError,
    conflictReport,
    isDiffLoading,
    selectedFile,
    selectFile,
    viewMode,
    setViewMode,
    openRepoDialog,
    refreshDiff,
    showToast,
  } = useGitStore();

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

  const [previewTab, setPreviewTab] = useState<'commits' | 'diff'>('commits');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    isLoadingReviewerOptions,
    showBotDropdown,
    setShowBotDropdown,
    toggleReviewerDropdown,
    handleToggleBot,
    handleRemoveBot,
    botDropdownRef,
    isLoadingLabelOptions,
    showLabelDropdown,
    setShowLabelDropdown,
    toggleLabelDropdown,
    handleToggleLabel,
    handleRemoveLabel,
    labelSearch,
    setLabelSearch,
    newLabelColor,
    setNewLabelColor,
    handleCreateAndSelectLabel,
    labelDropdownRef,
  } = useNewMrMetadata({
    reloadPersistedReviewers,
    currentRepo,
    refreshRepoMetadata,
    draftMr,
    updateDraftMr,
    repoLabels,
    createRepoLabel,
  });

  if (!draftMr) return null;

  const sameBranch = draftMr.baseBranch === draftMr.compareBranch;
  const sameCommit = Boolean(
    diffPayload?.base_commit && diffPayload.base_commit === diffPayload.compare_commit
  );
  const isIdentical = sameBranch || sameCommit;
  const noFileChanges = Boolean(
    !isDiffLoading && !diffError && diffPayload && diffPayload.files.length === 0
  );
  const canCreateVirtualMr = Boolean(
    !isDiffLoading &&
      !diffError &&
      !draftMr.isCommitsLoading &&
      !draftMr.commitsError &&
      diffPayload &&
      diffPayload.files.length > 0
  );
  const hasConflicts = Boolean(conflictReport?.has_conflicts && !noFileChanges);
  const conflictCount = conflictReport?.conflicted_files.length || 0;

  const handleBaseChange = (newBase: string) => {
    changeDraftBranches(newBase, draftMr.compareBranch);
  };

  const handleCompareChange = (newCompare: string) => {
    changeDraftBranches(draftMr.baseBranch, newCompare);
  };

  const handleSwapBranches = () => {
    changeDraftBranches(draftMr.compareBranch, draftMr.baseBranch);
  };

  const handleGenerateDescription = () => {
    if (!draftMr) return;

    const draft = createNewMrDescriptionDraft(draftMr, diffPayload);

    if (draftMr.description.trim() && draftMr.description.trim() !== draft.trim()) {
      if (window.confirm('Replace current description with a draft from commit metadata?')) {
        updateDraftMr({ description: draft });
        showToast('Generated description from commit metadata. No AI request was sent.');
      }
    } else {
      updateDraftMr({ description: draft });
      showToast('Generated description from commit metadata. No AI request was sent.');
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!canCreateVirtualMr || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const sessionId = await submitNewMrDraft();
      if (!sessionId || draftMr.selectedBots.length === 0) return;
      // Assigning reviewers while creating the MR also starts the full review batch.
      // Remote providers are allowed here so the flow does not ask for a second confirmation.
      startNewMrReviewBatch(sessionId);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-mantle text-text select-none">
      {/* 1. TOP HEADER & PROMINENT BRANCH COMPARISON BAR */}
      <NewVirtualMrHeader
        closeNewMrDraft={closeNewMrDraft}
        draftMr={draftMr}
        branches={branches}
        handleBaseChange={handleBaseChange}
        handleSwapBranches={handleSwapBranches}
        handleCompareChange={handleCompareChange}
        diffError={diffError}
        isDiffLoading={isDiffLoading}
        conflictCheckError={conflictCheckError}
        noFileChanges={noFileChanges}
        isIdentical={isIdentical}
        hasConflicts={hasConflicts}
        conflictCount={conflictCount}
        conflictReport={conflictReport}
      />

      {/* 2. MAIN BODY */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {diffError ? (
          <NewVirtualMrComparisonError diffError={diffError} refreshDiff={refreshDiff} />
        ) : isDiffLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-subtext1">
            <Loader2 className="w-7 h-7 animate-spin text-brand mb-3" />
            <span className="text-sm font-medium text-text">Comparing branches…</span>
            <span className="text-xs text-subtext0 mt-1">
              Loading file changes and mergeability
            </span>
          </div>
        ) : noFileChanges ? (
          /* IDENTICAL BRANCHES EMPTY STATE */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none">
            <div className="max-w-md flex flex-col items-center animate-in fade-in zoom-in-95 duration-150">
              <div className="w-12 h-12 bg-surface0 border border-surface1 flex items-center justify-center text-subtext0 mb-4 shadow-sm rounded-sm">
                <GitBranch className="w-6 h-6 text-subtext1" />
              </div>
              <h2 className="text-sm font-semibold text-text mb-1.5">
                There isn't anything to compare
              </h2>
              <p className="text-xs text-subtext0 leading-relaxed mb-4">
                <code className="px-1.5 py-0.5 bg-surface0 text-brand font-mono font-medium border border-surface1/60">
                  {draftMr.baseBranch}
                </code>{' '}
                and{' '}
                <code className="px-1.5 py-0.5 bg-surface0 text-brand font-mono font-medium border border-surface1/60">
                  {draftMr.compareBranch}
                </code>{' '}
                {isIdentical
                  ? 'point to the same commit. Choose a different compare branch to review changes.'
                  : 'have no file differences from the merge base. Choose another compare branch with changes to open a Virtual MR.'}
              </p>
            </div>
          </div>
        ) : (
          /* COMPARISON WORKSPACE */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* MR METADATA FORM & PRIMARY CREATION BAR */}
            <NewVirtualMrFormSection
              draftMr={draftMr}
              updateDraftMr={updateDraftMr}
              handleGenerateDescription={handleGenerateDescription}
              effectiveReviewers={effectiveReviewers}
              isLoadingReviewerOptions={isLoadingReviewerOptions}
              showBotDropdown={showBotDropdown}
              setShowBotDropdown={setShowBotDropdown}
              toggleReviewerDropdown={toggleReviewerDropdown}
              handleToggleBot={handleToggleBot}
              handleRemoveBot={handleRemoveBot}
              botDropdownRef={botDropdownRef}
              repoLabels={repoLabels}
              isLoadingLabelOptions={isLoadingLabelOptions}
              showLabelDropdown={showLabelDropdown}
              setShowLabelDropdown={setShowLabelDropdown}
              toggleLabelDropdown={toggleLabelDropdown}
              handleToggleLabel={handleToggleLabel}
              handleRemoveLabel={handleRemoveLabel}
              labelSearch={labelSearch}
              setLabelSearch={setLabelSearch}
              newLabelColor={newLabelColor}
              setNewLabelColor={setNewLabelColor}
              handleCreateAndSelectLabel={handleCreateAndSelectLabel}
              labelDropdownRef={labelDropdownRef}
              handleSubmit={handleSubmit}
              isSubmitting={isSubmitting}
              canCreateVirtualMr={canCreateVirtualMr}
              closeNewMrDraft={closeNewMrDraft}
            />

            {/* PREVIEW SECTION: COMMITS & DIFF */}
            <NewVirtualMrPreview
              setPreviewTab={setPreviewTab}
              previewTab={previewTab}
              draftMr={draftMr}
              diffPayload={diffPayload}
              changeDraftBranches={changeDraftBranches}
              selectedFile={selectedFile}
              selectFile={selectFile}
              isDiffLoading={isDiffLoading}
              viewMode={viewMode}
              setViewMode={setViewMode}
              openRepoDialog={openRepoDialog}
            />
          </div>
        )}
      </div>
    </div>
  );
};
