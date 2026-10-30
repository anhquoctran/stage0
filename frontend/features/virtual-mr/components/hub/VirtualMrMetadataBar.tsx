import { useRef } from 'react';
import { useTranslation as useUiTextTranslation } from 'react-i18next';
import { useOutsideDismiss } from '../../../../common/hooks/useOutsideDismiss';
import { Bot } from '../../../../common/components/icons/Bot';
import { Check } from '../../../../common/components/icons/Check';
import { FileCode } from '../../../../common/components/icons/FileCode';
import { GitCommit } from '../../../../common/components/icons/GitCommit';
import { MessageSquare } from '../../../../common/components/icons/MessageSquare';
import { Plus } from '../../../../common/components/icons/Plus';
import type { VirtualMrMetadataBarProps } from './VirtualMrMetadataBarProps';

export function VirtualMrMetadataBar({
  session,
  toggleLabelDropdown,
  showLabelDropdown,
  setShowLabelDropdown,
  openRepoSettings,
  isLoadingLabelOptions,
  repoLabels,
  toggleSessionLabel,
  setActiveMrTab,
  activeMrTab,
  diffPayload,
}: VirtualMrMetadataBarProps) {
  const { t: translateUiText } = useUiTextTranslation();
  const labelDropdownRef = useRef<HTMLDivElement>(null);
  useOutsideDismiss(labelDropdownRef, showLabelDropdown, () => setShowLabelDropdown(false));
  return (
    <div className="px-4 py-1.5 flex items-center justify-between gap-4 bg-mantle text-xs border-b border-surface0/40 rounded-sm">
      {/* 4 WORKSPACE TABS */}
      <div className="flex items-center gap-1 bg-crust p-0.5 shrink-0 rounded-sm border border-surface0/50">
        <button
          type="button"
          onClick={() => setActiveMrTab('overview')}
          className={`px-3 py-1 text-xs transition-colors flex items-center gap-1.5 cursor-pointer rounded-sm ${
            activeMrTab === 'overview'
              ? 'bg-surface2 text-text font-semibold shadow-2xs'
              : 'text-subtext0 hover:text-text hover:bg-surface0/60'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>{translateUiText('virtualMr.metadataBar.overview')}</span>
          {session.discussions.length > 0 && (
            <span
              className={`ms-0.5 px-1.5 py-[0.2rem] rounded-full text-[10px] font-mono ${
                activeMrTab === 'overview'
                  ? 'bg-surface1 text-text'
                  : 'bg-surface0 text-subtext0'
              }`}
            >
              {session.discussions.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveMrTab('commits')}
          className={`px-3 py-1 text-xs transition-colors flex items-center gap-1.5 cursor-pointer rounded-sm ${
            activeMrTab === 'commits'
              ? 'bg-surface2 text-text font-semibold shadow-2xs'
              : 'text-subtext0 hover:text-text hover:bg-surface0/60'
          }`}
        >
          <GitCommit className="w-3.5 h-3.5" />
          <span>{translateUiText('virtualMr.metadataBar.commits')}</span>
          {session.commits.length > 0 && (
            <span
              className={`ms-0.5 px-1.5 py-[0.2rem] rounded-full text-[10px] font-mono ${
                activeMrTab === 'commits'
                  ? 'bg-surface1 text-text'
                  : 'bg-surface0 text-subtext0'
              }`}
            >
              {session.commits.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveMrTab('reviews')}
          className={`px-3 py-1 text-xs transition-colors flex items-center gap-1.5 cursor-pointer rounded-sm ${
            activeMrTab === 'reviews'
              ? 'bg-surface2 text-text font-semibold shadow-2xs'
              : 'text-subtext0 hover:text-text hover:bg-surface0/60'
          }`}
        >
          <Bot className="w-3.5 h-3.5" />
          <span>{translateUiText('virtualMr.metadataBar.aiReviews')}</span>
          {session.reviewers.length > 0 && (
            <span
              className={`ms-0.5 px-1.5 py-[0.2rem] rounded-full text-[10px] font-mono ${
                activeMrTab === 'reviews'
                  ? 'bg-purple-500/20 text-purple-700 dark:text-purple-300 font-semibold'
                  : 'bg-surface0 text-subtext0'
              }`}
            >
              {session.reviewers.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveMrTab('diff')}
          className={`px-3 py-1 text-xs transition-colors flex items-center gap-1.5 cursor-pointer rounded-sm ${
            activeMrTab === 'diff'
              ? 'bg-surface2 text-text font-semibold shadow-2xs'
              : 'text-subtext0 hover:text-text hover:bg-surface0/60'
          }`}
        >
          <FileCode className="w-3.5 h-3.5" />
          <span>{translateUiText('virtualMr.metadataBar.changes')}</span>
          <span
            className={`ms-0.5 px-1.5 py-[0.2rem] rounded-full text-[10px] font-mono ${
              activeMrTab === 'diff'
                ? 'bg-surface1 text-text'
                : 'bg-surface0 text-subtext0'
            }`}
          >
            {diffPayload?.files.length || 0}
          </span>
        </button>
      </div>

      {/* QUICK LABELS SUMMARY */}
      <div ref={labelDropdownRef} className="relative flex items-center gap-1.5">
        {session.labels.map((lbl) => (
          <span
            key={lbl.id}
            className="px-2 py-0.5 rounded-sm text-[10px] font-medium text-white shadow-2xs truncate max-w-28"
            style={{ backgroundColor: lbl.color }}
          >
            {lbl.name}
          </span>
        ))}
        <button
          type="button"
          onClick={() => void toggleLabelDropdown()}
          className="p-1 rounded-sm bg-surface1 hover:bg-surface2 text-subtext0 hover:text-text cursor-pointer"
          title={translateUiText('virtualMr.metadataBar.toggleLabels')}
        >
          <Plus className="w-3 h-3" />
        </button>

        {/* Label Dropdown */}
        {showLabelDropdown && (
          <div className="absolute top-full end-0 mt-1 w-56 rounded-sm bg-crust border border-surface0 shadow-xl py-1 z-50">
            <div className="px-3 py-1.5 flex items-center justify-between text-[11px] font-semibold text-subtext0 uppercase tracking-wider border-b border-surface0/60 rounded-sm">
              <span>{translateUiText('virtualMr.metadataBar.toggleLabels')}</span>
              <button
                type="button"
                onClick={() => {
                  setShowLabelDropdown(false);
                  openRepoSettings('labels');
                }}
                className="text-accent hover:underline text-[10px] lowercase rounded-sm cursor-pointer"
              >
                {translateUiText('virtualMr.metadataBar.manage')}
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto py-1">
              {isLoadingLabelOptions ? (
                <div className="px-3 py-3 text-xs text-subtext0">{translateUiText('virtualMr.labels.loading')}</div>
              ) : (
                repoLabels.map((lbl) => {
                  const isChecked = session.labels.some((l) => l.id === lbl.id);
                  return (
                    <button
                      key={lbl.id}
                      type="button"
                      onClick={() => void toggleSessionLabel(session.id, lbl.id)}
                      className="w-full px-3 py-1.5 flex items-center justify-between text-start hover:bg-surface0 cursor-pointer rounded-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-sm shrink-0"
                          style={{ backgroundColor: lbl.color }}
                        />
                        <span className="text-xs text-text">{lbl.name}</span>
                      </div>
                      {isChecked && <Check className="w-3.5 h-3.5 text-accent" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
