import React from 'react';
import { Info } from '../../../../common/components/icons/Info';
import { useGitStore } from '../../../../features/git/store/useGitStore';

export const TopBarRepoOverviewButton: React.FC<{
  shortcut: (value: string) => string;
}> = ({ shortcut }) => {
  const { currentRepo, setIsRepoOverviewOpen } = useGitStore();

  if (!currentRepo) return null;

  return (
    <button
      type="button"
      onClick={() => setIsRepoOverviewOpen(true)}
      className="h-12 min-w-[58px] px-2.5 flex flex-col items-center justify-center hover:bg-surface0 text-subtext1 hover:text-text transition-colors cursor-pointer group rounded-sm"
      title={shortcut('Repository Overview (Ctrl+I)')}
      aria-label="Repository Overview"
    >
      <Info className="w-5 h-5 text-primary shrink-0 transition-colors" />
      <span className="text-[11px] font-medium leading-none mt-1.5 tracking-tight transition-colors whitespace-nowrap">
        Overview
      </span>
    </button>
  );
};

