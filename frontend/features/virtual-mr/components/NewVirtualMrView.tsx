import React, { useState, useRef, useEffect, useMemo } from 'react';
import { GitPullRequest } from '../../../common/components/icons/GitPullRequest';
import { GitBranch } from '../../../common/components/icons/GitBranch';
import { ArrowLeftRight } from '../../../common/components/icons/ArrowLeftRight';
import { CheckCircle2 } from '../../../common/components/icons/CheckCircle2';
import { AlertTriangle } from '../../../common/components/icons/AlertTriangle';
import { Info } from '../../../common/components/icons/Info';
import { GitCommit } from '../../../common/components/icons/GitCommit';
import { FileCode } from '../../../common/components/icons/FileCode';
import { X } from '../../../common/components/icons/X';
import { Loader2 } from '../../../common/components/icons/Loader2';
import { formatRecentTime } from '@/common/utils/dateTime';
import { useVirtualMrStore } from '../store/useVirtualMrStore';
import { useGitStore } from '../../git/store/useGitStore';
import { useBotReviewersStore } from '../../ai/store/useBotReviewersStore';
import { startAssignedReviewBatchForSession } from '../../review/services/assignedReviewService';
import { TabBranchSelector } from '../../git/components/TabBranchSelector';
import { MarkdownEditor } from '../../../common/components/MarkdownEditor';
import { FileList } from '../../git/components/FileList';
import { formatShortcutText } from '../../../common/utils/shortcuts';
import { NewVirtualMrReviewersSection } from './NewVirtualMrReviewersSection';
import { NewVirtualMrLabelsSection } from './NewVirtualMrLabelsSection';
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
  }, [currentRepo?.id, repoSettings?.inheritGlobalAgents, getEffectiveReviewers, globalReviewers, repoActiveBotIds, repoCustomReviewers]);

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
    !isDiffLoading
      && !diffError
      && !draftMr.isCommitsLoading
      && !draftMr.commitsError
      && diffPayload
      && diffPayload.files.length > 0
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
        : (diffPayload?.files && diffPayload.files.length > 0
            ? diffPayload.files.slice(0, 8).map((f) => `- Modified \`${f.path}\``).join('\n')
            : '- Ongoing branch changes');

    const fileList =
      diffPayload?.files && diffPayload.files.length > 0
        ? diffPayload.files.slice(0, 10).map((f) => `- \`${f.path}\` (${(f.status || 'MODIFIED').toLowerCase()})`).join('\n')
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
      void startAssignedReviewBatchForSession(sessionId).then((result) => {
        if (result.failures.length) {
          useGitStore.getState().showToast(`Virtual MR created. AI review failed or incomplete: ${[result.failures[0], !result.descriptionGenerated ? 'The MR description was not updated.' : 'The MR description was saved.'].join(' ')}`, 'warning');
        } else if (!result.descriptionGenerated) {
          useGitStore.getState().showToast(result.hasChanges
            ? 'Virtual MR created, but no reviewer could generate its description from the available diff.'
            : 'Virtual MR created, but no changed files were found in its review snapshot.', result.hasChanges ? 'warning' : 'info');
        } else {
          const partial = result.runs.some((run) => run.status === 'partial');
          useGitStore.getState().showToast(`AI review ${partial ? 'finished with incomplete coverage' : 'completed'} for ${result.runs.length} assigned reviewers. The MR description was updated.`, partial ? 'warning' : 'success');
        }
      }).catch((error) => {
        useGitStore.getState().showToast(`Virtual MR created, but AI review could not start: ${error instanceof Error ? error.message : String(error)}`, 'error');
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-mantle text-text select-none">
      {/* 1. TOP HEADER & PROMINENT BRANCH COMPARISON BAR */}
      <div className="border-b border-surface0 bg-crust/50 px-5 py-3 shrink-0 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-brand/10 border border-brand/20 flex items-center justify-center text-brand">
              <GitPullRequest className="w-3.5 h-3.5 text-brand" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xs font-semibold text-text">
                  Comparing changes
                </h1>
                <span className="text-[10px] font-mono px-1.5 py-0.2 bg-surface0 border border-surface1/60 text-subtext0 font-medium">
                  draft
                </span>
              </div>
              <p className="text-[11px] text-subtext0 mt-0.5">
                Choose two branches to see what's changed or to create a Virtual MR.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeNewMrDraft}
            className="p-1.5 text-subtext0 hover:text-text hover:bg-surface0 transition-colors cursor-pointer"
            title={formatShortcutText('Cancel & close comparison (Esc / Ctrl+W)')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Branch Comparator Ribbon (GitHub / GitLab Inspired) */}
        <div className="flex items-center justify-between flex-wrap gap-3 px-3.5 py-2 bg-base/50 border border-surface0">
          {/* Branch Selectors */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Base Branch */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-medium text-subtext0 select-none">
                base:
              </span>
              <TabBranchSelector
                roleType="target"
                value={draftMr.baseBranch}
                branches={branches}
                onChange={handleBaseChange}
                maxWidthClass="max-w-[240px] lg:max-w-[340px]"
              />
            </div>

            {/* Direction Arrow & Swap Button */}
            <button
              type="button"
              onClick={handleSwapBranches}
              className="p-1.5 text-subtext0 hover:text-brand hover:bg-surface0 border border-transparent hover:border-surface0 transition-colors cursor-pointer"
              title="Swap Base and Compare branches"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
            </button>

            {/* Compare Branch */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-medium text-subtext0 select-none">
                compare:
              </span>
              <TabBranchSelector
                roleType="source"
                value={draftMr.compareBranch}
                branches={branches}
                onChange={handleCompareChange}
                maxWidthClass="max-w-[240px] lg:max-w-[340px]"
              />
            </div>
          </div>

          {/* Mergeability Status Indicator (Matches Stage0 Status Palette) */}
          <div className="flex items-center gap-2">
            {diffError ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-red bg-red/10 border border-red/25">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>Comparison failed</span>
              </div>
            ) : isDiffLoading ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-subtext1 bg-surface0/40 border border-surface0">
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                <span>Comparing branches…</span>
              </div>
            ) : conflictCheckError ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-text bg-yellow/10 border border-yellow/25" title={conflictCheckError}>
                <AlertTriangle className="w-3.5 h-3.5 text-yellow shrink-0" />
                <span>Mergeability check unavailable</span>
              </div>
            ) : noFileChanges ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-subtext0 bg-surface0/60 border border-surface0">
                <Info className="w-3.5 h-3.5 text-subtext0 shrink-0" />
                <span>{isIdentical ? 'Same commit · no changes' : 'No file changes'}</span>
              </div>
            ) : hasConflicts ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-red bg-red/10 border border-red/20">
                <AlertTriangle className="w-3.5 h-3.5 text-red shrink-0" />
                <span>
                  Can't automatically merge ({conflictCount} {conflictCount === 1 ? 'conflict' : 'conflicts'})
                </span>
              </div>
            ) : conflictReport ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-white bg-[#238636]">
                <CheckCircle2 className="w-3.5 h-3.5 text-white shrink-0" />
                <span>Able to merge. These branches can be automatically merged.</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-subtext0 bg-surface0/40 border border-surface0">
                <Info className="w-3.5 h-3.5 shrink-0" />
                <span>Mergeability not checked</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. MAIN BODY */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {diffError ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none">
            <div className="w-12 h-12 bg-red/10 border border-red/30 flex items-center justify-center text-red mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-sm font-semibold text-text mb-1.5">Couldn't compare these branches</h2>
            <p className="text-xs text-subtext1 max-w-lg leading-relaxed mb-4">
              Check that both refs still exist and that the repository is available. Select valid branches, then retry.
            </p>
            <details className="max-w-xl w-full text-left text-xs text-subtext0 mb-4">
              <summary className="cursor-pointer hover:text-text">Git error details</summary>
              <pre className="mt-2 p-3 bg-crust border border-surface0 whitespace-pre-wrap break-words select-text">{diffError}</pre>
            </details>
            <button
              type="button"
              onClick={() => void refreshDiff()}
              className="flex items-center gap-2 px-3 py-1.5 bg-surface0 hover:bg-surface1 border border-surface1 text-text text-xs transition-colors cursor-pointer"
            >
              <GitBranch className="w-3.5 h-3.5" />
              Retry comparison
            </button>
          </div>
        ) : isDiffLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-subtext1">
            <Loader2 className="w-7 h-7 animate-spin text-brand mb-3" />
            <span className="text-sm font-medium text-text">Comparing branches…</span>
            <span className="text-xs text-subtext0 mt-1">Loading file changes and mergeability</span>
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
            <div className="border-b border-surface0 bg-base/50 p-4 shrink-0 space-y-3">
              <div className="flex items-start gap-4">
                <div className="flex-1 space-y-2.5">
                  {/* Title Input */}
                  <input
                    type="text"
                    value={draftMr.title}
                    onChange={(e) => updateDraftMr({ title: e.target.value })}
                    placeholder="Virtual MR Title..."
                    className="w-full px-3 py-1.5 bg-mantle border border-surface1 focus:border-brand text-xs text-text font-medium placeholder:text-subtext0 outline-none transition-colors"
                  />

                  {/* Markdown Description */}
                  <div className="border border-surface1 bg-mantle overflow-hidden">
                    <MarkdownEditor
                      value={draftMr.description}
                      onChange={(description) => updateDraftMr({ description })}
                      placeholder="Write your description or notes here..."
                      minHeight="110px"
                      onGenerateDraft={handleGenerateDescription}
                    />
                  </div>
                </div>

                {/* Sidebar Configuration (Bots & Labels) + Create Action */}
                <div className="w-72 shrink-0 space-y-3">
                  {/* Reviewers Section */}
                  <NewVirtualMrReviewersSection
                    selectedBots={draftMr.selectedBots}
                    effectiveReviewers={effectiveReviewers}
                    isLoadingReviewerOptions={isLoadingReviewerOptions}
                    showBotDropdown={showBotDropdown}
                    setShowBotDropdown={setShowBotDropdown}
                    onToggleReviewerDropdown={toggleReviewerDropdown}
                    onToggleBot={handleToggleBot}
                    onRemoveBot={handleRemoveBot}
                    botDropdownRef={botDropdownRef}
                  />

                  {/* Labels Section */}
                  <NewVirtualMrLabelsSection
                    selectedLabels={draftMr.selectedLabels}
                    repoLabels={repoLabels}
                    isLoadingLabelOptions={isLoadingLabelOptions}
                    showLabelDropdown={showLabelDropdown}
                    setShowLabelDropdown={setShowLabelDropdown}
                    onToggleLabelDropdown={toggleLabelDropdown}
                    onToggleLabel={handleToggleLabel}
                    onRemoveLabel={handleRemoveLabel}
                    labelSearch={labelSearch}
                    setLabelSearch={setLabelSearch}
                    newLabelColor={newLabelColor}
                    setNewLabelColor={setNewLabelColor}
                    handleCreateAndSelectLabel={handleCreateAndSelectLabel}
                    labelDropdownRef={labelDropdownRef}
                  />

                  {/* Create Button */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleSubmit()}
                      disabled={isSubmitting || !canCreateVirtualMr}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-brand hover:bg-brand/90 active:scale-[0.98] text-on-accent font-bold text-xs shadow-md shadow-brand/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-4 h-4 animate-spin text-on-accent" />
                      ) : (
                        <GitPullRequest className="w-4 h-4 stroke-[2.5]" />
                      )}
                      <span>Create Virtual MR</span>
                    </button>

                    <button
                      type="button"
                      onClick={closeNewMrDraft}
                      className="px-3 py-2 bg-surface0 hover:bg-surface1 text-subtext0 hover:text-text text-xs font-medium transition-colors cursor-pointer border border-surface1/60"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* PREVIEW SECTION: COMMITS & DIFF */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Preview Subtab Navigation */}
              <div className="h-9 border-b border-surface0 bg-crust px-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-1 h-full">
                  <button
                    type="button"
                    onClick={() => setPreviewTab('commits')}
                    className={`flex items-center gap-2 px-3 h-full text-xs font-medium transition-colors cursor-pointer border-b-2 ${
                      previewTab === 'commits'
                        ? 'border-brand text-text bg-mantle'
                        : 'border-transparent text-subtext0 hover:text-text hover:bg-surface0/40'
                    }`}
                  >
                    <GitCommit className="w-3.5 h-3.5 text-brand" />
                    <span>Commits</span>
                    <span className="px-1.5 py-0.2 text-[10px] font-mono bg-surface0 border border-surface1/60 text-subtext0">
                      {draftMr.commits.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPreviewTab('diff')}
                    className={`flex items-center gap-2 px-3 h-full text-xs font-medium transition-colors cursor-pointer border-b-2 ${
                      previewTab === 'diff'
                        ? 'border-brand text-text bg-mantle'
                        : 'border-transparent text-subtext0 hover:text-text hover:bg-surface0/40'
                    }`}
                  >
                    <FileCode className="w-3.5 h-3.5 text-subtext0" />
                    <span>Files changed</span>
                    <span className="px-1.5 py-0.2 text-[10px] font-mono bg-surface0 border border-surface1/60 text-subtext0">
                      {diffPayload?.files.length || 0}
                    </span>
                  </button>
                </div>

                {/* Diff stats overview */}
                {diffPayload && (
                  <div className="flex items-center gap-2 text-[11px] font-mono text-subtext0">
                    <span className="text-emerald-400 font-semibold">
                      +{(diffPayload.files || []).reduce((acc, f) => acc + (f.additions || 0), 0)}
                    </span>
                    <span className="text-red font-semibold">
                      -{(diffPayload.files || []).reduce((acc, f) => acc + (f.deletions || 0), 0)}
                    </span>
                  </div>
                )}
              </div>

              {/* Preview Content Area */}
              <div className="flex-1 flex overflow-hidden">
                {previewTab === 'commits' ? (
                  /* COMMITS LIST PREVIEW */
                  <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {draftMr.isCommitsLoading ? (
                      <div className="p-8 flex items-center justify-center gap-2 text-subtext0 text-xs">
                        <Loader2 className="w-4 h-4 animate-spin text-brand" />
                        <span>Loading commits between branches...</span>
                      </div>
                    ) : draftMr.commitsError ? (
                      <div className="p-6 flex flex-col items-center gap-2 text-center text-xs">
                        <AlertTriangle className="w-4 h-4 text-yellow" />
                        <span className="text-text">Couldn't load commits for this comparison.</span>
                        <details className="max-w-xl text-left text-subtext0">
                          <summary className="cursor-pointer hover:text-text">Git error details</summary>
                          <pre className="mt-2 p-3 bg-base border border-surface0 whitespace-pre-wrap break-words select-text">{draftMr.commitsError}</pre>
                        </details>
                        <button
                          type="button"
                          onClick={() => void changeDraftBranches(draftMr.baseBranch, draftMr.compareBranch)}
                          className="mt-1 px-3 py-1.5 bg-surface0 hover:bg-surface1 border border-surface1 text-text transition-colors cursor-pointer"
                        >
                          Retry loading commits
                        </button>
                      </div>
                    ) : draftMr.commits.length === 0 ? (
                      <div className="p-8 text-center text-subtext0 text-xs italic">
                        No commits unique to {draftMr.compareBranch} relative to {draftMr.baseBranch}.
                      </div>
                    ) : (
                      draftMr.commits.map((c) => (
                        <div
                          key={c.hash}
                          className="flex items-center justify-between p-3 border border-surface0/80 bg-base hover:border-surface1 hover:bg-surface0/30 transition-all shadow-xs"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
                            <div className="w-7 h-7 bg-brand/10 border border-brand/20 flex items-center justify-center text-brand shrink-0">
                              <GitCommit className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-semibold text-text truncate">
                                {c.subject}
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-subtext0 mt-0.5">
                                <span className="text-subtext1 font-medium">{c.authorName}</span>
                                <span>•</span>
                                <span>{formatRecentTime(c.authoredDate)}</span>
                              </div>
                            </div>
                          </div>

                          <div className="shrink-0">
                            <span className="px-2 py-1 bg-surface0 text-[10px] font-mono text-brand border border-surface1">
                              {c.shortHash}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
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
                    <React.Suspense fallback={<div className="flex-1 grid place-items-center text-subtext0 text-xs">Loading diff viewer…</div>}>
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
