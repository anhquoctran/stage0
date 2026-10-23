import React from 'react';
import { useGitStore } from '../../../features/git/store/useGitStore';
import { formatShortcutText } from '../../../common/utils/shortcuts';
import { GitGraphModal } from '../../../features/git/components/GitGraphModal';
import { TopBarTitleRow } from './top-bar/TopBarTitleRow';
import { TopBarRepoBadge } from './top-bar/TopBarRepoBadge';
import { TopBarActionRibbon } from './top-bar/TopBarActionRibbon';
import { TopBarRebasingBanner } from './top-bar/TopBarRebasingBanner';
import { TopBarRepoOverviewButton } from './top-bar/TopBarRepoOverviewButton';

export const TopBar: React.FC = () => {
  const { currentRepo, isGitGraphOpen, setIsGitGraphOpen } = useGitStore();

  const isMac =
    typeof navigator !== 'undefined' &&
    (/Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ||
      (typeof window !== 'undefined' && window.location.search.includes('platform=mac')));
  const shortcut = (value: string) => formatShortcutText(value, isMac);

  return (
    <header className="flex flex-col shrink-0 select-none">
      {/* ROW 1: Window Titlebar & Controls */}
      <TopBarTitleRow isMac={isMac} />

      {/* ROW 2: Git Workspace Action Toolbar */}
      <div className="h-16 bg-mantle border-b border-surface0 px-3.5 flex items-center justify-between shrink-0 select-none relative z-40 rounded-sm">
        {/* Left Section: Active Repository + SourceTree Action Ribbon */}
        <div className="flex items-center gap-2 min-w-0">
          <TopBarRepoBadge />
          <TopBarActionRibbon shortcut={shortcut} />
        </div>

        {/* Right Section: Sync Status & Rebase in-progress strip */}
        <div className="flex items-center gap-2.5 shrink-0">
          <TopBarRebasingBanner />
          <TopBarRepoOverviewButton shortcut={shortcut} />
        </div>
      </div>

      <GitGraphModal
        isOpen={isGitGraphOpen && Boolean(currentRepo)}
        repoPath={currentRepo?.local_path || ''}
        onClose={() => setIsGitGraphOpen(false)}
      />
    </header>
  );
};
