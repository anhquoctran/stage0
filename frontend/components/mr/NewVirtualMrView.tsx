import React, { useState, useRef, useEffect } from 'react';
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
  Plus,
  Check,
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
    createRepoLabel,
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
  const [showBotDropdown, setShowBotDropdown] = useState(false);
  const [showLabelDropdown, setShowLabelDropdown] = useState(false);
  const [labelSearch, setLabelSearch] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#3b82f6');
  const botDropdownRef = useRef<HTMLDivElement>(null);
  const labelDropdownRef = useRef<HTMLDivElement>(null);

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
            title="Cancel & close comparison (Esc / Ctrl+W)"
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
            {isIdentical ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-subtext0 bg-surface0/60 border border-surface0">
                <Info className="w-3.5 h-3.5 text-subtext0 shrink-0" />
                <span>Identical branches (no changes)</span>
              </div>
            ) : hasConflicts ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-red bg-red/10 border border-red/20">
                <AlertTriangle className="w-3.5 h-3.5 text-red shrink-0" />
                <span>
                  Can't automatically merge ({conflictCount} {conflictCount === 1 ? 'conflict' : 'conflicts'})
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-green bg-green/10 border border-green/20">
                <CheckCircle2 className="w-3.5 h-3.5 text-green shrink-0" />
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
                    className="w-full px-3 py-1.5 bg-mantle border border-surface1 focus:border-brand text-xs text-text font-medium placeholder:text-subtext0 outline-none transition-colors"
                  />

                  {/* Markdown Description */}
                  <div className="border border-surface1 bg-mantle overflow-hidden">
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
                  {/* Reviewers Section (GitHub/GitLab style) */}
                  <div className="relative p-3 border border-surface1 bg-mantle/70 space-y-2 select-none" ref={botDropdownRef}>
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-subtext1 flex items-center gap-1.5">
                        <Bot className="w-3.5 h-3.5 text-brand" />
                        <span>Reviewers</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowBotDropdown(!showBotDropdown)}
                        className="p-1 text-subtext0 hover:text-brand hover:bg-surface0 transition-colors cursor-pointer"
                        title="Assign Reviewer Bots"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Selected Reviewers Chips or Empty State */}
                    {draftMr.selectedBots.length === 0 ? (
                      <div className="text-xs text-subtext0/70 italic py-0.5">
                        No reviewers requested
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {draftMr.selectedBots.map((botId) => {
                          const bot = AVAILABLE_AI_BOTS.find((b) => b.id === botId);
                          if (!bot) return null;
                          return (
                            <div
                              key={bot.id}
                              className="flex items-center gap-1.5 px-2 py-0.5 bg-brand/10 border border-brand/20 text-brand text-xs font-medium"
                            >
                              <span>{bot.avatarEmoji}</span>
                              <span className="truncate max-w-[130px]">{bot.name}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveBot(bot.id)}
                                className="text-brand/60 hover:text-red hover:bg-surface0 transition-colors cursor-pointer ml-0.5"
                                title={`Remove ${bot.name}`}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Reviewer Dropdown Popover */}
                    {showBotDropdown && (
                      <div className="absolute top-full right-0 mt-1 w-64 bg-mantle border border-surface0 shadow-2xl z-50 py-1 animate-in fade-in zoom-in-95 duration-100">
                        <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-subtext0 bg-base/60 border-b border-surface0/60 flex items-center justify-between">
                          <span>Assign AI Reviewer</span>
                          <button
                            type="button"
                            onClick={() => setShowBotDropdown(false)}
                            className="text-subtext0 hover:text-text cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="max-h-56 overflow-y-auto divide-y divide-surface0/60">
                          {AVAILABLE_AI_BOTS.map((bot) => {
                            const isAssigned = draftMr.selectedBots.includes(bot.id);
                            return (
                              <button
                                key={bot.id}
                                type="button"
                                onClick={() => handleToggleBot(bot.id)}
                                className={`w-full px-3 py-2 flex items-center justify-between text-left transition-colors cursor-pointer ${
                                  isAssigned ? 'bg-brand/10 text-brand' : 'hover:bg-surface0 text-text'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0 pr-2">
                                  <span className="text-base shrink-0">{bot.avatarEmoji}</span>
                                  <div className="truncate">
                                    <div className="text-xs font-medium truncate">{bot.name}</div>
                                    <div className="text-[10px] text-subtext0 truncate">{bot.tagline}</div>
                                  </div>
                                </div>
                                {isAssigned && <Check className="w-3.5 h-3.5 text-brand shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Labels Section (GitHub/GitLab style) */}
                  <div className="relative p-3 border border-surface1 bg-mantle/70 space-y-2 select-none" ref={labelDropdownRef}>
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-subtext1 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-teal" />
                        <span>Labels</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowLabelDropdown(!showLabelDropdown)}
                        className="p-1 text-subtext0 hover:text-teal hover:bg-surface0 transition-colors cursor-pointer"
                        title="Edit Labels"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Selected Labels Chips or Empty State */}
                    {draftMr.selectedLabels.length === 0 ? (
                      <div className="text-xs text-subtext0/70 italic py-0.5">
                        None yet
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {draftMr.selectedLabels.map((lblId) => {
                          const lbl = repoLabels.find((l) => l.id === lblId);
                          if (!lbl) return null;
                          return (
                            <div
                              key={lbl.id}
                              className="flex items-center gap-1 px-2 py-0.5 text-xs font-mono font-medium border"
                              style={{
                                backgroundColor: `${lbl.color}20`,
                                borderColor: `${lbl.color}40`,
                                color: lbl.color,
                              }}
                            >
                              <span className="truncate max-w-[120px]">{lbl.name}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveLabel(lbl.id)}
                                className="hover:opacity-100 opacity-60 transition-opacity cursor-pointer ml-0.5"
                                title={`Remove ${lbl.name}`}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Label Dropdown Popover */}
                    {showLabelDropdown && (
                      <div className="absolute top-full right-0 mt-1 w-64 bg-mantle border border-surface0 shadow-2xl z-50 py-1 animate-in fade-in zoom-in-95 duration-100">
                        <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-subtext0 bg-base/60 border-b border-surface0/60 flex items-center justify-between">
                          <span>Apply Labels</span>
                          <button
                            type="button"
                            onClick={() => setShowLabelDropdown(false)}
                            className="text-subtext0 hover:text-text cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Filter / Create input */}
                        <div className="p-2 bg-base/40 border-b border-surface0/60 space-y-1.5">
                          <div className="relative">
                            <input
                              type="text"
                              placeholder="Filter or type to add..."
                              value={labelSearch}
                              onChange={(e) => setLabelSearch(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleCreateAndSelectLabel();
                                }
                              }}
                              className="w-full px-2.5 py-1 bg-mantle border border-surface0 text-xs text-text placeholder-subtext0 focus:outline-none focus:border-brand font-mono"
                              autoFocus
                            />
                          </div>

                          {/* Color picker presets if typing a new label */}
                          {labelSearch.trim() && !repoLabels.some((l) => l.name.toLowerCase() === labelSearch.trim().toLowerCase()) && (
                            <div className="flex items-center justify-between pt-1">
                              <span className="text-[10px] text-subtext0">Color:</span>
                              <div className="flex items-center gap-1">
                                {['#3b82f6', '#10b981', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'].map((color) => (
                                  <button
                                    key={color}
                                    type="button"
                                    onClick={() => setNewLabelColor(color)}
                                    className={`w-3.5 h-3.5 border transition-transform cursor-pointer ${
                                      newLabelColor === color ? 'scale-125 border-white' : 'border-transparent hover:scale-110'
                                    }`}
                                    style={{ backgroundColor: color }}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Label Items List */}
                        <div className="max-h-48 overflow-y-auto divide-y divide-surface0/40">
                          {/* Create new label action button if search input doesn't match existing */}
                          {labelSearch.trim() && !repoLabels.some((l) => l.name.toLowerCase() === labelSearch.trim().toLowerCase()) && (
                            <button
                              type="button"
                              onClick={handleCreateAndSelectLabel}
                              className="w-full px-3 py-2 flex items-center gap-2 hover:bg-surface0 text-left text-xs text-brand transition-colors cursor-pointer font-medium"
                            >
                              <Plus className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">Create label <strong>"{labelSearch.trim()}"</strong></span>
                            </button>
                          )}

                          {/* Existing labels */}
                          {repoLabels
                            .filter((lbl) => lbl.name.toLowerCase().includes(labelSearch.toLowerCase()))
                            .map((lbl) => {
                              const isSelected = draftMr.selectedLabels.includes(lbl.id);
                              return (
                                <button
                                  key={lbl.id}
                                  type="button"
                                  onClick={() => handleToggleLabel(lbl.id)}
                                  className={`w-full px-3 py-1.5 flex items-center justify-between text-left text-xs font-mono transition-colors cursor-pointer ${
                                    isSelected ? 'bg-surface0 text-text' : 'hover:bg-surface0/60 text-subtext0'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 truncate pr-2">
                                    <span
                                      className="w-2.5 h-2.5 shrink-0"
                                      style={{ backgroundColor: lbl.color }}
                                    />
                                    <span className="truncate">{lbl.name}</span>
                                  </div>
                                  {isSelected && <Check className="w-3.5 h-3.5 text-brand shrink-0" />}
                                </button>
                              );
                            })}

                          {repoLabels.length === 0 && !labelSearch.trim() && (
                            <div className="px-3 py-3 text-xs text-subtext0/70 italic text-center">
                              No labels yet. Type above to create one.
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

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
                    ) : draftMr.commits.length === 0 ? (
                      <div className="p-8 text-center text-subtext0 text-xs italic">
                        No commits found between {draftMr.compareBranch} and {draftMr.baseBranch}.
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
                                <span>{formatRelativeTime(c.authoredDate)}</span>
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
