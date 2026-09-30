import React, { useState } from 'react';
import {
  GitPullRequest,
  GitBranch,
  ArrowLeftRight,
  CheckCircle2,
  AlertTriangle,
  Info,
  GitCommit,
  FileCode,
  Bot,
  Tag,
  X,
  Loader2,
} from 'lucide-react';
import { useVirtualMrStore } from '../../store/useVirtualMrStore';
import { useGitStore } from '../../store/useGitStore';
import { AVAILABLE_AI_BOTS } from '../../types/virtualMr';
import { TabBranchSelector } from '../git/TabBranchSelector';
import { MarkdownEditor } from '../common/MarkdownEditor';
import { FileList } from '../git/FileList';
import { DiffViewer } from '../git/DiffViewer';

export const NewVirtualMrView: React.FC = () => {
  const {
    draftMr,
    updateDraftMr,
    changeDraftBranches,
    closeNewMrDraft,
    submitNewMrDraft,
    repoLabels,
  } = useVirtualMrStore();

  const {
    branches,
    diffPayload,
    conflictReport,
    isDiffLoading,
    selectedFile,
    selectFile,
    viewMode,
    setViewMode,
    openRepoDialog,
  } = useGitStore();

  const [previewTab, setPreviewTab] = useState<'commits' | 'diff'>('commits');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!draftMr) return null;

  const isIdentical = draftMr.baseBranch === draftMr.compareBranch;
  const hasConflicts = Boolean(conflictReport?.has_conflicts && !isIdentical);
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
    const exists = draftMr.selectedBots.includes(botId);
    const updated = exists
      ? draftMr.selectedBots.filter((id) => id !== botId)
      : [...draftMr.selectedBots, botId];
    updateDraftMr({ selectedBots: updated });
  };

  const handleToggleLabel = (labelId: string) => {
    const exists = draftMr.selectedLabels.includes(labelId);
    const updated = exists
      ? draftMr.selectedLabels.filter((id) => id !== labelId)
      : [...draftMr.selectedLabels, labelId];
    updateDraftMr({ selectedLabels: updated });
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isIdentical || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await submitNewMrDraft();
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatRelativeTime = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 30) return `${diffDays}d ago`;
      return date.toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-mantle text-text select-none">
      {/* 1. TOP HEADER & PROMINENT BRANCH COMPARISON BAR (GitHub / GitLab Style) */}
      <div className="border-b border-surface0 bg-crust/80 px-6 py-4 shrink-0 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand/15 border border-brand/30 flex items-center justify-center text-brand">
              <GitPullRequest className="w-4 h-4 text-brand" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-text flex items-center gap-2">
                <span>Comparing changes</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface1 text-subtext1">
                  Draft
                </span>
              </h1>
              <p className="text-xs text-subtext0">
                Choose two branches to see what's changed or to create a Virtual MR.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeNewMrDraft}
            className="p-1.5 rounded-md hover:bg-surface0 text-subtext0 hover:text-text transition-colors cursor-pointer"
            title="Cancel & close comparison (Ctrl+W)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Large Prominent Branch Selector Bar */}
        <div className="flex items-center justify-between flex-wrap gap-3 p-3 rounded-xl bg-surface0/70 border border-surface1 shadow-xs">
          {/* Branch Selectors */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Base Branch */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-base border border-surface1 shadow-xs">
              <span className="text-[11px] font-mono font-bold text-subtext0 uppercase tracking-wider">
                base:
              </span>
              <TabBranchSelector
                roleType="target"
                value={draftMr.baseBranch}
                branches={branches}
                onChange={handleBaseChange}
              />
            </div>

            {/* Direction Arrow & Swap Button */}
            <button
              type="button"
              onClick={handleSwapBranches}
              className="p-2 rounded-lg bg-base border border-surface1 text-subtext0 hover:text-brand hover:border-brand/40 transition-all cursor-pointer shadow-xs active:scale-95"
              title="Swap Base and Compare branches"
            >
              <ArrowLeftRight className="w-4 h-4 text-brand" />
            </button>

            {/* Compare Branch */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-base border border-surface1 shadow-xs">
              <span className="text-[11px] font-mono font-bold text-brand uppercase tracking-wider">
                compare:
              </span>
              <TabBranchSelector
                roleType="source"
                value={draftMr.compareBranch}
                branches={branches}
                onChange={handleCompareChange}
              />
            </div>
          </div>

          {/* Mergeability Status Prediction */}
          <div className="flex items-center gap-2">
            {isIdentical ? (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface1 text-subtext0 text-xs font-medium">
                <Info className="w-3.5 h-3.5 text-subtext1" />
                <span>Identical branches</span>
              </div>
            ) : hasConflicts ? (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red/15 text-red border border-red/30 text-xs font-medium">
                <AlertTriangle className="w-3.5 h-3.5 text-red" />
                <span>Can't automatically merge ({conflictCount} conflicts)</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Able to merge. These branches can be automatically merged.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. MAIN BODY */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {isIdentical ? (
          /* IDENTICAL BRANCHES EMPTY STATE */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none">
            <div className="max-w-md flex flex-col items-center animate-in fade-in zoom-in-95 duration-150">
              <div className="w-14 h-14 rounded-2xl bg-surface0 border border-surface1 flex items-center justify-center text-subtext0 mb-4 shadow-sm">
                <GitBranch className="w-7 h-7 text-subtext1" />
              </div>
              <h2 className="text-base font-bold text-text mb-1.5">
                There isn't anything to compare
              </h2>
              <p className="text-xs text-subtext0 leading-relaxed mb-4">
                <code className="px-1.5 py-0.5 rounded bg-surface0 text-brand font-mono font-medium">
                  {draftMr.baseBranch}
                </code>{' '}
                and{' '}
                <code className="px-1.5 py-0.5 rounded bg-surface0 text-brand font-mono font-medium">
                  {draftMr.compareBranch}
                </code>{' '}
                are completely identical. Please choose a different compare branch to see changes and open a Virtual MR.
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
                    className="w-full px-3 py-1.5 bg-mantle border border-surface1 focus:border-brand rounded-lg text-sm text-text font-medium placeholder:text-subtext0 outline-none transition-colors shadow-xs"
                  />

                  {/* Markdown Description */}
                  <div className="rounded-lg border border-surface1 bg-mantle overflow-hidden shadow-xs">
                    <MarkdownEditor
                      value={draftMr.description}
                      onChange={(description) => updateDraftMr({ description })}
                      placeholder="Write your description or notes here (supports Markdown)..."
                      minHeight="110px"
                    />
                  </div>
                </div>

                {/* Sidebar Configuration (Bots & Labels) + Create Action */}
                <div className="w-72 shrink-0 space-y-3">
                  {/* Reviewer Bots Chip Selector */}
                  <div className="p-3 rounded-lg border border-surface1 bg-mantle/70 space-y-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-subtext1 flex items-center gap-1.5">
                      <Bot className="w-3.5 h-3.5 text-brand" />
                      <span>AI Reviewer Bots</span>
                    </div>
                    <div className="space-y-1.5">
                      {AVAILABLE_AI_BOTS.map((bot) => {
                        const isAssigned = draftMr.selectedBots.includes(bot.id);
                        return (
                          <button
                            key={bot.id}
                            type="button"
                            onClick={() => handleToggleBot(bot.id)}
                            className={`w-full flex items-center justify-between px-2.5 py-1 text-xs transition-colors cursor-pointer border text-left ${
                              isAssigned
                                ? 'bg-brand/10 border-brand/40 text-brand font-medium'
                                : 'bg-surface0/40 border-surface0 hover:bg-surface0 text-subtext0 hover:text-text'
                            }`}
                          >
                            <span className="truncate">{bot.name}</span>
                            {isAssigned && <CheckCircle2 className="w-3.5 h-3.5 text-brand shrink-0 ml-1" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Labels Chip Selector */}
                  {repoLabels.length > 0 && (
                    <div className="p-3 rounded-lg border border-surface1 bg-mantle/70 space-y-2">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-subtext1 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-teal" />
                        <span>Labels</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                        {repoLabels.map((lbl) => {
                          const isSelected = draftMr.selectedLabels.includes(lbl.id);
                          return (
                            <button
                              key={lbl.id}
                              type="button"
                              onClick={() => handleToggleLabel(lbl.id)}
                              className={`px-2 py-0.5 text-[10px] font-mono transition-all cursor-pointer border ${
                                isSelected
                                  ? 'bg-surface2 text-text border-brand font-semibold shadow-xs'
                                  : 'bg-surface0/60 text-subtext0 border-surface1/60 hover:text-text hover:bg-surface1'
                              }`}
                            >
                              {lbl.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Create Button */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleSubmit()}
                      disabled={isSubmitting || isIdentical}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-brand hover:bg-brand/90 active:scale-[0.98] text-[#11111b] font-bold text-xs shadow-md shadow-brand/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-4 h-4 animate-spin text-[#11111b]" />
                      ) : (
                        <GitPullRequest className="w-4 h-4 stroke-[2.5]" />
                      )}
                      <span>Create Virtual MR</span>
                    </button>

                    <button
                      type="button"
                      onClick={closeNewMrDraft}
                      className="px-3 py-2 border border-surface1 hover:bg-surface0 text-subtext0 hover:text-text text-xs transition-colors cursor-pointer"
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
              <div className="h-10 border-b border-surface0 bg-crust px-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPreviewTab('commits')}
                    className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                      previewTab === 'commits'
                        ? 'bg-surface1 text-text'
                        : 'text-subtext0 hover:text-text hover:bg-surface0'
                    }`}
                  >
                    <GitCommit className="w-3.5 h-3.5 text-brand" />
                    <span>Commits</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-surface0 text-subtext1">
                      {draftMr.commits.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPreviewTab('diff')}
                    className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                      previewTab === 'diff'
                        ? 'bg-surface1 text-text'
                        : 'text-subtext0 hover:text-text hover:bg-surface0'
                    }`}
                  >
                    <FileCode className="w-3.5 h-3.5 text-teal" />
                    <span>Files changed</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-surface0 text-subtext1">
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
                    ) : draftMr.commits.length === 0 ? (
                      <div className="p-8 text-center text-subtext0 text-xs italic">
                        No commits found between {draftMr.compareBranch} and {draftMr.baseBranch}.
                      </div>
                    ) : (
                      draftMr.commits.map((c) => (
                        <div
                          key={c.hash}
                          className="flex items-center justify-between p-3 rounded-lg border border-surface0/80 bg-base hover:border-surface1 hover:bg-surface0/30 transition-all shadow-xs"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
                            <div className="w-7 h-7 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center text-brand shrink-0">
                              <GitCommit className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-semibold text-text truncate">
                                {c.subject}
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-subtext0 mt-0.5">
                                <span className="text-subtext1 font-medium">{c.authorName}</span>
                                <span>•</span>
                                <span>{formatRelativeTime(c.authoredDate)}</span>
                              </div>
                            </div>
                          </div>

                          <div className="shrink-0">
                            <span className="px-2 py-1 rounded bg-surface0 text-[10px] font-mono text-brand border border-surface1">
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
                    <DiffViewer
                      selectedFile={selectedFile}
                      diffPayload={diffPayload}
                      viewMode={viewMode}
                      onToggleViewMode={setViewMode}
                      isLoading={isDiffLoading}
                      onOpenRepo={openRepoDialog}
                    />
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
