import React from 'react';
import { clsx } from 'clsx';
import { invoke } from '@tauri-apps/api/core';
import { AppLogo } from '../../../../common/components/AppLogo';
import { MenuBar } from '../MenuBar';
import { WindowControls } from '../WindowControls';
import { useGitStore } from '../../../../features/git/store/useGitStore';
import { useAboutInfo } from '../../../../features/about/hooks/useAboutInfo';

export const TopBarTitleRow: React.FC<{
  isMac: boolean;
}> = ({ isMac }) => {
  const { currentRepo, baseBranch, compareBranch } = useGitStore();
  const about = useAboutInfo();

  const handleDoubleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, input, select, [role="button"], a')) {
      return;
    }
    invoke<boolean>('window_toggle_maximize').catch(() => {});
  };

  const titleText = currentRepo
    ? `${currentRepo.name} — [${compareBranch || '...'} → ${baseBranch || '...'}]`
    : `Stage0 v${about.packageVersion} — Virtual MR Sandbox`;
  const visibleTitleText = currentRepo ? titleText : 'Stage0 — Virtual MR Sandbox';
  const versionLabel = (
    <span
      data-tauri-drag-region
      title={`Stage0 v${about.packageVersion}`}
      aria-label={`Stage0 version ${about.packageVersion}`}
      className="text-[10px] font-mono text-subtext0 select-none truncate min-w-0"
    >
      v{about.packageVersion}
    </span>
  );

  return (
    <div
      data-tauri-drag-region
      onDoubleClick={handleDoubleClick}
      className={clsx(
        'h-8.5 bg-crust border-b border-surface0/70 rounded-none items-center shrink-0 select-none transition-all relative z-[100]',
        isMac
          ? 'grid grid-cols-[5rem_minmax(0,1fr)_5rem] px-3'
          : 'flex justify-between pl-2.5 pr-0'
      )}
    >
      {isMac ? (
        <>
          {/* Mounted for shortcuts & macOS native system menu events */}
          <MenuBar hidden />

          {/* Reserve the native traffic-light area; controls are rendered by macOS */}
          <div data-tauri-drag-region aria-hidden="true" className="w-20 h-full shrink-0" />

          {/* Center: Draggable Window Document Title */}
          <div
            data-tauri-drag-region
            className="h-full flex items-center justify-center min-w-0 overflow-hidden px-4"
          >
            <span
              data-tauri-drag-region
              title={titleText}
              className="text-[11px] font-mono text-subtext0/70 truncate pointer-events-none"
            >
              {visibleTitleText}
            </span>
          </div>

          {/* Match the traffic-light reserve so the document title stays centered. */}
          <div data-tauri-drag-region className="h-full min-w-0 flex items-center justify-end">
            {versionLabel}
          </div>
        </>
      ) : (
        <>
          {/* Left: Brand Icon + Stage0 + VSCode Menu Bar */}
          <div className="flex items-center gap-2 h-full">
            <div
              data-tauri-drag-region
              className="flex items-center gap-1.5 pr-2.5 border-r border-surface0/80 cursor-default"
            >
              <AppLogo size="sm" />
              <span className="text-xs font-bold tracking-tight text-text">Stage0</span>
              {versionLabel}
            </div>

            <MenuBar />
          </div>

          {/* Center: Draggable Window Document Title */}
          <div
            data-tauri-drag-region
            className="flex-1 h-full flex items-center justify-center min-w-8 overflow-hidden px-4"
          >
            <span
              data-tauri-drag-region
              title={titleText}
              className="text-[11px] font-mono text-subtext0/70 truncate pointer-events-none"
            >
              {visibleTitleText}
            </span>
          </div>

          {/* Right: Window Controls */}
          <div className="flex items-center h-full shrink-0">
            <WindowControls style="windows" />
          </div>
        </>
      )}
    </div>
  );
};
