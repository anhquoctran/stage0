import { AlertTriangle } from '../../../../common/components/icons/AlertTriangle';
import { ArrowLeftRight } from '../../../../common/components/icons/ArrowLeftRight';
import { CheckCircle2 } from '../../../../common/components/icons/CheckCircle2';
import { GitPullRequest } from '../../../../common/components/icons/GitPullRequest';
import { Info } from '../../../../common/components/icons/Info';
import { Loader2 } from '../../../../common/components/icons/Loader2';
import { X } from '../../../../common/components/icons/X';
import { formatShortcutText } from '../../../../common/utils/shortcuts';
import { TabBranchSelector } from '../../../git/components/TabBranchSelector';
import type { NewVirtualMrHeaderProps } from './NewVirtualMrHeaderProps';

export function NewVirtualMrHeader({
  closeNewMrDraft,
  draftMr,
  branches,
  handleBaseChange,
  handleSwapBranches,
  handleCompareChange,
  diffError,
  isDiffLoading,
  conflictCheckError,
  noFileChanges,
  isIdentical,
  hasConflicts,
  conflictCount,
  conflictReport,
}: NewVirtualMrHeaderProps) {
  return (
    <div className="border-b border-surface0 bg-crust/50 px-5 py-3 shrink-0 space-y-2.5 rounded-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-brand/10 border border-brand/20 flex items-center justify-center text-brand">
            <GitPullRequest className="w-3.5 h-3.5 text-brand" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xs font-semibold text-text">Comparing changes</h1>
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
          className="p-1.5 text-subtext0 hover:text-text hover:bg-surface0 transition-colors cursor-pointer rounded-sm"
          title={formatShortcutText('Cancel & close comparison (Esc / Ctrl+W)')}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Branch Comparator Ribbon (GitHub / GitLab Inspired) */}
      <div className="flex items-center justify-between flex-wrap gap-3 px-3.5 py-2 bg-base/50 border border-surface0 rounded-sm">
        {/* Branch Selectors */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Base Branch */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-subtext0 select-none">base:</span>
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
            className="p-1.5 text-subtext0 hover:text-brand hover:bg-surface0 border border-transparent hover:border-surface0 transition-colors cursor-pointer rounded-sm"
            title="Swap Base and Compare branches"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
          </button>

          {/* Compare Branch */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-subtext0 select-none">compare:</span>
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
            <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-red bg-red/10 border border-red/25 rounded-sm">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>Comparison failed</span>
            </div>
          ) : isDiffLoading ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-subtext1 bg-surface0/40 border border-surface0 rounded-sm">
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              <span>Comparing branches…</span>
            </div>
          ) : conflictCheckError ? (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-text bg-yellow/10 border border-yellow/25 rounded-sm"
              title={conflictCheckError}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-yellow shrink-0" />
              <span>Mergeability check unavailable</span>
            </div>
          ) : noFileChanges ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-subtext0 bg-surface0/60 border border-surface0 rounded-sm">
              <Info className="w-3.5 h-3.5 text-subtext0 shrink-0" />
              <span>{isIdentical ? 'Same commit · no changes' : 'No file changes'}</span>
            </div>
          ) : hasConflicts ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-red bg-red/10 border border-red/20 rounded-sm">
              <AlertTriangle className="w-3.5 h-3.5 text-red shrink-0" />
              <span>
                Can't automatically merge ({conflictCount}{' '}
                {conflictCount === 1 ? 'conflict' : 'conflicts'})
              </span>
            </div>
          ) : conflictReport ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-white bg-[#238636] rounded-sm">
              <CheckCircle2 className="w-3.5 h-3.5 text-white shrink-0" />
              <span>Able to merge. These branches can be automatically merged.</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-subtext0 bg-surface0/40 border border-surface0 rounded-sm">
              <Info className="w-3.5 h-3.5 shrink-0" />
              <span>Mergeability not checked</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
