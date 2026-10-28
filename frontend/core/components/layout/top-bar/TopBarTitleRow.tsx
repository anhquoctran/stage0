import { useWindowChromeStore } from '../../../store/useWindowChromeStore';
import { titleBarMouseDown } from './titleBarMouseDown';
import { useApplicationServices } from '../../../services/runtime/useApplicationServices';
import React from 'react';
import { clsx } from 'clsx';

import { AppLogo } from '../../../../common/components/AppLogo';
import { MenuBar } from '../MenuBar';
import { WindowControls } from '../WindowControls';
import { useGitStore } from '../../../../features/git/store/useGitStore';
import { useAboutInfo } from '../../../../features/about/hooks/useAboutInfo';

export const TopBarTitleRow: React.FC<{
  isMac: boolean;
}> = ({ isMac }) => {
  const appServices = useApplicationServices();
  const { currentRepo, baseBranch, compareBranch } = useGitStore();
  const about = useAboutInfo();

  const profile = useWindowChromeStore((state) => state.profile);
  const linux = profile.platform === 'linux';
  const dragRegion = linux ? undefined : isMac ? false : true;

  const titleText = currentRepo
    ? `${currentRepo.name} — [${compareBranch || '...'} → ${baseBranch || '...'}]`
    : `Stage0 v${about.packageVersion} — Virtual MR Sandbox`;
  const visibleTitleText = currentRepo ? titleText : 'Stage0 — Virtual MR Sandbox';
  const versionLabel = (
    <span
      data-tauri-drag-region={dragRegion}
      title={`Stage0 v${about.packageVersion}`}
      aria-label={`Stage0 version ${about.packageVersion}`}
      className="text-[10px] font-mono text-subtext0 select-none truncate min-w-0"
    >
      v{about.packageVersion}
    </span>
  );

  if (linux && profile.nativeFrame) {
    return (
      <div className="h-7 bg-crust border-b border-surface0/70 rounded-none flex items-center justify-between gap-3 px-2.5 shrink-0 select-none relative z-[100]">
        <MenuBar />
        {versionLabel}
      </div>
    );
  }

  return (
    <div
      data-tauri-drag-region={linux ? false : true}
      onMouseDown={titleBarMouseDown(profile, appServices.application, isMac)}
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

          {/* Custom macOS traffic lights replace native window decorations. */}
          <WindowControls style="mac" className="w-20 -translate-x-4 justify-center" />

          {/* Center: Draggable Window Document Title */}
          <div
            data-tauri-drag-region={dragRegion}
            className="h-full flex items-center justify-center min-w-0 overflow-hidden px-4"
          >
            <span
              data-tauri-drag-region={dragRegion}
              title={titleText}
              className="text-[11px] font-mono text-subtext0/70 truncate pointer-events-none"
            >
              {visibleTitleText}
            </span>
          </div>

          {/* Match the traffic-light reserve so the document title stays centered. */}
          <div data-tauri-drag-region={dragRegion} className="h-full min-w-0 flex items-center justify-end">
            {versionLabel}
          </div>
        </>
      ) : (
        <>
          {/* Left: Brand Icon + Stage0 + VSCode Menu Bar */}
          <div className="flex items-center gap-2 h-full min-w-0">
            {linux && !profile.nativeFrame && profile.controlsLeft.length > 0 && (
              <WindowControls style="windows" buttons={profile.controlsLeft} />
            )}
            <div
              data-tauri-drag-region={dragRegion}
              className="flex items-center gap-1.5 pe-2.5 border-e border-surface0/80 cursor-default"
            >
              <AppLogo size="sm" />
              <span className="text-xs font-bold tracking-tight text-text">Stage0</span>
              {versionLabel}
            </div>

            <MenuBar />
          </div>

          {/* Center: Draggable Window Document Title */}
          <div
            data-tauri-drag-region={dragRegion}
            className="flex-1 h-full flex items-center justify-center min-w-8 overflow-hidden px-4"
          >
            <span
              data-tauri-drag-region={dragRegion}
              title={titleText}
              className="text-[11px] font-mono text-subtext0/70 truncate pointer-events-none"
            >
              {visibleTitleText}
            </span>
          </div>

          {/* Right: Window Controls */}
          <div className="flex items-center h-full shrink-0">
            {!profile.nativeFrame && <WindowControls style="windows" buttons={linux ? profile.controlsRight : undefined} />}
          </div>
        </>
      )}
    </div>
  );
};
