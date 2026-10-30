import React from 'react';
import { Trans, useTranslation as useUiTextTranslation } from 'react-i18next';
import { GitPullRequest } from '../../../common/components/icons/GitPullRequest';
import { Plus } from '../../../common/components/icons/Plus';
import { Sparkles } from '../../../common/components/icons/Sparkles';
import { FolderGit2 } from '../../../common/components/icons/FolderGit2';
import { useCommandShortcut } from '../../../core/hooks/useCommandShortcut';
import type { EmptyVirtualMrWorkspaceProps } from '../types/EmptyVirtualMrWorkspaceProps';

export const EmptyVirtualMrWorkspace: React.FC<EmptyVirtualMrWorkspaceProps> = ({
  onNewMr,
  repoName,
  defaultBaseBranch,
}) => {
  const { t: translateUiText } = useUiTextTranslation();
  const { shortcut } = useCommandShortcut();
  return (
  <div className="flex flex-1 flex-col items-center justify-center bg-crust p-8 text-center font-sans select-none rounded-sm">
    <div className="flex max-w-md flex-col items-center animate-in fade-in zoom-in-95 duration-200">
      <div className="relative mb-6">
        <div className="flex h-16 w-16 items-center justify-center border border-surface1 bg-mantle text-brand shadow-xl rounded-sm">
          <GitPullRequest className="h-8 w-8 text-brand" />
        </div>
      </div>

      <h2 className="mb-2 text-lg font-bold text-text">{translateUiText('virtualMr.emptyWorkspace.title')}</h2>
      <p className="mb-6 text-xs leading-relaxed text-subtext0">
        <Trans
          i18nKey="virtualMr.emptyWorkspace.description"
          values={{ repo: repoName }}
          components={{ repo: <span className="font-mono font-medium text-text" /> }}
        />
      </p>

      <button
        type="button"
        onClick={onNewMr}
        className="mb-4 flex items-center gap-2 bg-brand px-5 py-2.5 text-xs font-semibold text-on-accent shadow-lg shadow-brand/20 transition-all hover:bg-brand/90 active:scale-[0.98] rounded-sm"
      >
        <Plus className="h-4 w-4 stroke-[2.5]" />
        <span>{translateUiText('virtualMr.emptyWorkspace.create')}</span>
        <kbd className="ms-1.5 border border-black/10 bg-black/15 px-1.5 py-0.5 font-mono text-[10px] text-on-accent/80">
          {shortcut('new_mr')}
        </kbd>
      </button>

      <div className="flex items-center gap-4 border-t border-surface0/60 pt-4 text-[11px] text-subtext1 rounded-sm">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-brand" />
          <span>{translateUiText('virtualMr.emptyWorkspace.localReview')}</span>
        </div>
        <span className="text-surface1">•</span>
        <div className="flex items-center gap-1.5">
          <FolderGit2 className="h-3.5 w-3.5 text-accent" />
          <span>{translateUiText('virtualMr.emptyWorkspace.targetBranch', { branch: defaultBaseBranch })}</span>
        </div>
      </div>
    </div>
  </div>
  );
};
