import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GitBranch } from '../../../common/components/icons/GitBranch';
import { Loader2 } from '../../../common/components/icons/Loader2';
import { useBotReviewersStore } from '../../ai/store/useBotReviewersStore';
import { FileList } from '../../git/components/FileList';
import { useGitStore } from '../../git/store/useGitStore';
import { startAssignedReviewBatchForSession } from '../../review/services/assignedReviewService';
import { useVirtualMrStore } from '../store/useVirtualMrStore';
import { NewVirtualMrCommitsList } from './new-mr/NewVirtualMrCommitsList';
import { NewVirtualMrComparisonError } from './new-mr/NewVirtualMrComparisonError';
import { NewVirtualMrFormSection } from './new-mr/NewVirtualMrFormSection';
import { NewVirtualMrHeader } from './new-mr/NewVirtualMrHeader';
import { NewVirtualMrPreviewToolbar } from './new-mr/NewVirtualMrPreviewToolbar';
import { NewVirtualMrViewDiffViewer } from './NewVirtualMrViewDiffViewer';

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
  const [showBotDropdown, setShowBotDropdown] = useState(false);
  const [showLabelDropdown, setShowLabelDropdown] = useState(false);
  const [isLoadingReviewerOptions, setIsLoadingReviewerOptions] = useState(false);
  const [isLoadingLabelOptions, setIsLoadingLabelOptions] = useState(false);
  const [labelSearch, setLabelSearch] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#3b82f6');
  const botDropdownRef = useRef<HTMLDivElement>(null);
  const labelDropdownRef = useRef<HTMLDivElement>(null);

  const toggleReviewerDropdown = async () => {
    const willOpen = !showBotDropdown;
    setShowBotDropdown(willOpen);
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
    const handleClickOutside = (e: MouseEvent) => {
      if (botDropdownRef.current && !botDropdownRef.current.contains(e.target as Node)) {
        setShowBotDropdown(false);
      }
      if (labelDropdownRef.current && !labelDropdownRef.current.contains(e.target as Node)) {
        setShowLabelDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const handleToggleBot = (botId: string) => {
    if (!draftMr) return;
    const exists = draftMr.selectedBots.includes(botId);
    const updated = exists
      ? draftMr.selectedBots.filter((id) => id !== botId)
      : [...draftMr.selectedBots, botId];
    updateDraftMr({ selectedBots: updated });
  };

  const handleRemoveBot = (botId: string) => {
    if (!draftMr) return;
    updateDraftMr({ selectedBots: draftMr.selectedBots.filter((id) => id !== botId) });
  };

  const handleToggleLabel = (labelId: string) => {
    if (!draftMr) return;
    const exists = draftMr.selectedLabels.includes(labelId);
    const updated = exists
      ? draftMr.selectedLabels.filter((id) => id !== labelId)
      : [...draftMr.selectedLabels, labelId];
    updateDraftMr({ selectedLabels: updated });
  };

  const handleRemoveLabel = (labelId: string) => {
    if (!draftMr) return;
    updateDraftMr({ selectedLabels: draftMr.selectedLabels.filter((id) => id !== labelId) });
  };

  const handleCreateAndSelectLabel = async () => {
    const name = labelSearch.trim();
    if (!name || !draftMr) return;
    try {
      const existing = repoLabels.find((l) => l.name.toLowerCase() === name.toLowerCase());
      if (existing) {
        if (!draftMr.selectedLabels.includes(existing.id)) {
          updateDraftMr({ selectedLabels: [...draftMr.selectedLabels, existing.id] });
        }
      } else {
        const newLbl = await createRepoLabel(name, newLabelColor);
        if (newLbl) {
          updateDraftMr({ selectedLabels: [...draftMr.selectedLabels, newLbl.id] });
        }
      }
      setLabelSearch('');
    } catch (err) {
      console.error('Failed to create label:', err);
    }
  };

  const handleGenerateDescription = () => {
    if (!draftMr) return;

    const commitList =
      draftMr.commits && draftMr.commits.length > 0
        ? draftMr.commits.map((c) => `- ${c.subject} (\`${c.shortHash}\`)`).join('\n')
        : diffPayload?.files && diffPayload.files.length > 0
          ? diffPayload.files
              .slice(0, 8)
              .map((f) => `- Modified \`${f.path}\``)
              .join('\n')
          : '- Ongoing branch changes';

    const fileList =
      diffPayload?.files && diffPayload.files.length > 0
        ? diffPayload.files
            .slice(0, 10)
            .map((f) => `- \`${f.path}\` (${(f.status || 'MODIFIED').toLowerCase()})`)
            .join('\n')
        : '';
    const totalFiles = diffPayload?.files?.length || 0;
    const moreFiles = totalFiles > 10 ? `\n- ...and ${totalFiles - 10} more files` : '';

    const draft = `## Summary\nAutomated virtual merge request for \`${draftMr.compareBranch}\` into \`${draftMr.baseBranch}\`.\n\n### Key Changes\n${commitList}${fileList ? `\n\n### Changed Files (${totalFiles})\n${fileList}${moreFiles}` : ''}\n\n### Testing & Verification\n- [ ] Virtual mergeability verified\n- [ ] Local build & tests pass\n- [ ] AI bot reviews completed\n`;

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
      void startAssignedReviewBatchForSession(sessionId)
        .then((result) => {
          if (result.failures.length) {
            useGitStore
              .getState()
              .showToast(
                `Virtual MR created. AI review failed or incomplete: ${[result.failures[0], !result.descriptionGenerated ? 'The MR description was not updated.' : 'The MR description was saved.'].join(' ')}`,
                'warning'
              );
          } else if (!result.descriptionGenerated) {
            useGitStore
              .getState()
              .showToast(
                result.hasChanges
                  ? 'Virtual MR created, but no reviewer could generate its description from the available diff.'
                  : 'Virtual MR created, but no changed files were found in its review snapshot.',
                result.hasChanges ? 'warning' : 'info'
              );
          } else {
            const partial = result.runs.some((run) => run.status === 'partial');
            useGitStore
              .getState()
              .showToast(
                `AI review ${partial ? 'finished with incomplete coverage' : 'completed'} for ${result.runs.length} assigned reviewers. The MR description was updated.`,
                partial ? 'warning' : 'success'
              );
          }
        })
        .catch((error) => {
          useGitStore
            .getState()
            .showToast(
              `Virtual MR created, but AI review could not start: ${error instanceof Error ? error.message : String(error)}`,
              'error'
            );
        });
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
              <div className="w-12 h-12 bg-surface0 border border-surface1 flex items-center justify-center text-subtext0 mb-4 shadow-sm">
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
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Preview Subtab Navigation */}
              <NewVirtualMrPreviewToolbar
                setPreviewTab={setPreviewTab}
                previewTab={previewTab}
                draftMr={draftMr}
                diffPayload={diffPayload}
              />

              {/* Preview Content Area */}
              <div className="flex-1 flex overflow-hidden">
                {previewTab === 'commits' ? (
                  /* COMMITS LIST PREVIEW */
                  <NewVirtualMrCommitsList
                    draftMr={draftMr}
                    changeDraftBranches={changeDraftBranches}
                  />
                ) : (
                  /* FILES CHANGED / DIFF PREVIEW */
                  <div className="flex-1 flex overflow-hidden relative">
                    <FileList
                      files={diffPayload?.files || []}
                      selectedFile={selectedFile}
                      onSelectFile={selectFile}
                      isLoading={isDiffLoading}
                      width={280}
                    />
                    <React.Suspense
                      fallback={
                        <div className="flex-1 grid place-items-center text-subtext0 text-xs">
                          Loading diff viewer…
                        </div>
                      }
                    >
                      <NewVirtualMrViewDiffViewer
                        selectedFile={selectedFile}
                        diffPayload={diffPayload}
                        viewMode={viewMode}
                        onToggleViewMode={setViewMode}
                        isLoading={isDiffLoading}
                        onOpenRepo={openRepoDialog}
                      />
                    </React.Suspense>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
