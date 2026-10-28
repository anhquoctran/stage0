import React from 'react';
import { BackgroundTaskManager } from '../../../features/git/components/BackgroundTaskManager';
import { ReviewActivity } from '../../../features/review/components/ReviewActivity';
import { useGitStore } from '../../../features/git/store/useGitStore';
import { useVirtualMrStore } from '../../../features/virtual-mr/store/useVirtualMrStore';
import { StatusBarRepoInfo } from './status-bar/StatusBarRepoInfo';
import { StatusBarSandboxEngine } from './status-bar/StatusBarSandboxEngine';
import { StatusBarCompareStatus } from './status-bar/StatusBarCompareStatus';
import { StatusBarFileProgress } from './status-bar/StatusBarFileProgress';
import { StatusBarViewModeControls } from './status-bar/StatusBarViewModeControls';
import { StatusBarPerformanceMonitor } from './status-bar/StatusBarPerformanceMonitor';
import { StatusBarNotificationButton } from './status-bar/StatusBarNotificationButton';

export const StatusBar: React.FC = () => {
  const { currentRepo } = useGitStore();
  const hasActiveVirtualMr = useVirtualMrStore((state) => {
    const activeSession = state.sessions.find((session) => session.id === state.activeSessionId);
    return Boolean(
      currentRepo &&
      state.currentRepoId === currentRepo.id &&
      !state.isDraftActive &&
      activeSession?.repoId === currentRepo.id
    );
  });

  return (
    <footer className="min-h-7 h-auto bg-mantle border-t border-surface0/80 px-3 py-1 flex items-center justify-between gap-2 text-[11px] text-subtext1 shrink-0 select-none z-10">
      {/* Left: Repository info & Active branch */}
      <StatusBarRepoInfo />

      {/* Right: Engine, Merge Status, File Counter, View Mode & Shortcuts */}
      <div className="flex items-center gap-2 max-xl:gap-1 shrink-0 ms-auto">
        {currentRepo && (
          <>
            <StatusBarSandboxEngine />
            <StatusBarCompareStatus isVisible={hasActiveVirtualMr} />
            <StatusBarFileProgress />
            <div className="h-3.5 w-px bg-surface1/80 mx-0.5" />
          </>
        )}

        <StatusBarViewModeControls isVisible={hasActiveVirtualMr} />
        <StatusBarPerformanceMonitor />
        <BackgroundTaskManager />
        <ReviewActivity />
        <StatusBarNotificationButton />
      </div>
    </footer>
  );
};
