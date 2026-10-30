import React from 'react';
import { useTranslation } from 'react-i18next';
import { GitPullRequest } from '../../../../common/components/icons/GitPullRequest';
import { X } from '../../../../common/components/icons/X';
import { useCommandShortcut } from '../../../hooks/useCommandShortcut';
import type { NewMrDraft } from '../../../../features/virtual-mr/types/NewMrDraft';

export const TabBarDraftItem: React.FC<{
  draftMr: NewMrDraft;
  isActive: boolean;
  onActivate: () => void;
  onClose: () => void;
}> = ({ draftMr, isActive, onActivate, onClose }) => {
  const { t } = useTranslation();
  const displayTitle = draftMr.title || `${draftMr.compareBranch} → ${draftMr.baseBranch}`;
  const { title } = useCommandShortcut();

  return (
    <div
      onClick={onActivate}
      className={`group relative h-8 px-2.5 border-t border-x flex items-center gap-2 cursor-pointer transition-colors shrink-0 max-w-[260px] rounded-sm ${
        isActive
          ? 'bg-mantle border-surface1 text-text font-medium shadow-xs'
          : 'bg-crust/50 border-transparent text-subtext0 hover:text-text hover:bg-surface0/40'
      }`}
    >
      <GitPullRequest
        className={`w-3.5 h-3.5 shrink-0 ${
          isActive ? 'text-brand' : 'text-subtext0'
        }`}
      />
      <span
        className={`truncate text-xs ${isActive ? 'font-medium text-text' : 'text-subtext0'}`}
        title={displayTitle}
      >
        {draftMr.title || t('common.tabs.newVirtualMr')}
      </span>
      <span className="text-[10px] px-1.5 py-0.2 bg-brand/20 text-brand font-mono font-medium">
        {t('common.tabs.draft')}
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-surface1 text-subtext0 hover:text-text transition-opacity ms-1 cursor-pointer shrink-0 rounded-sm"
        title={title('close_tab', t('common.tabs.closeDraft'))}
      >
        <X className="w-3 h-3" />
      </button>
      {isActive && (
        <div className="absolute bottom-0 inset-x-0 h-0.5 bg-brand" />
      )}
    </div>
  );
};
