import React from 'react';
import { Columns2 } from '../../../../common/components/icons/Columns2';
import { Rows2 } from '../../../../common/components/icons/Rows2';
import { Check } from '../../../../common/components/icons/Check';
import { History } from '../../../../common/components/icons/History';
import { GitCommit } from '../../../../common/components/icons/GitCommit';
import { List } from '../../../../common/components/icons/List';
import { FolderTree } from '../../../../common/components/icons/FolderTree';
import { SunMoon } from '../../../../common/components/icons/SunMoon';
import { HeartPulse } from '../../../../common/components/icons/HeartPulse';
import { ChevronRight } from '../../../../common/components/icons/ChevronRight';
import { useGitStore } from '../../../../features/git/store/useGitStore';
import { useThemeStore } from '../../../store/useThemeStore';
import { usePreferencesStore } from '../../../../features/preferences/store/usePreferencesStore';
import { usePerformanceMonitorStore } from '../../../../features/performance/store/usePerformanceMonitorStore';

export const MenuBarViewMenu: React.FC<{
  isOpen: boolean;
  onToggle: () => void;
  onHover: () => void;
  onClose: () => void;
  shortcut: (value: string) => string;
  showPerformanceSubmenu: boolean;
  setShowPerformanceSubmenu: React.Dispatch<React.SetStateAction<boolean>>;
}> = ({
  isOpen,
  onToggle,
  onHover,
  onClose,
  shortcut,
  showPerformanceSubmenu,
  setShowPerformanceSubmenu,
}) => {
  const {
    currentRepo,
    viewMode,
    fileListLayout,
    setViewMode,
    setFileListLayout,
    setIsGitGraphOpen,
    fileViewTab,
    toggleFileBlame,
  } = useGitStore();

  const { themeMode, toggleTheme } = useThemeStore();
  const { showInlineBlame, toggleInlineBlame } = usePreferencesStore();
  const { isEnabled: isPerformanceMonitorEnabled, toggle: togglePerformanceMonitor } =
    usePerformanceMonitorStore();

  return (
    <div className="relative h-full flex items-center">
      <button
        type="button"
        onClick={onToggle}
        onMouseEnter={onHover}
        className={`px-2.5 py-1 text-xs font-normal transition-colors cursor-pointer rounded-sm ${
          isOpen
            ? 'bg-surface1 text-text'
            : 'text-subtext1 hover:text-text hover:bg-surface0'
        }`}
      >
        View
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-0.5 w-64 shadow-2xl bg-mantle border border-surface0 py-1.5 z-50 text-xs rounded-sm">
          {currentRepo && (
            <>
              <button
                type="button"
                onClick={() => {
                  setViewMode('split');
                  onClose();
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer rounded-sm"
              >
                <div className="flex items-center gap-2">
                  <Columns2 className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                  <span>Side-by-side (Split)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-subtext0 font-mono">S</span>
                  {viewMode === 'split' && <Check className="w-3.5 h-3.5 text-text" />}
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setViewMode('unified');
                  onClose();
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer rounded-sm"
              >
                <div className="flex items-center gap-2">
                  <Rows2 className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                  <span>Inline (Unified)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-subtext0 font-mono">U</span>
                  {viewMode === 'unified' && <Check className="w-3.5 h-3.5 text-text" />}
                </div>
              </button>

              <div className="my-1 border-t border-surface0" />

              <button
                type="button"
                onClick={() => {
                  toggleFileBlame();
                  onClose();
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer rounded-sm"
              >
                <div className="flex items-center gap-2">
                  <History className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                  <span>File Git Blame</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-subtext0 font-mono">{shortcut('Alt+B')}</span>
                  {fileViewTab === 'blame' && <Check className="w-3.5 h-3.5 text-text" />}
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  toggleInlineBlame();
                  onClose();
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer rounded-sm"
              >
                <div className="flex items-center gap-2">
                  <GitCommit className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                  <span>Inline Git Blame</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-subtext0 font-mono">{shortcut('Alt+Shift+B')}</span>
                  {showInlineBlame && <Check className="w-3.5 h-3.5 text-text" />}
                </div>
              </button>

              <div className="my-1 border-t border-surface0" />

              <button
                type="button"
                onClick={() => {
                  setIsGitGraphOpen(true);
                  onClose();
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer rounded-sm"
              >
                <div className="flex items-center gap-2">
                  <GitCommit className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                  <span>View Git Graph</span>
                </div>
              </button>

              <div className="my-1 border-t border-surface0" />

              <button
                type="button"
                onClick={() => {
                  setFileListLayout('flat');
                  onClose();
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer rounded-sm"
              >
                <div className="flex items-center gap-2">
                  <List className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                  <span>File List: Flat Layout</span>
                </div>
                {fileListLayout === 'flat' && <Check className="w-3.5 h-3.5 text-text" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  setFileListLayout('tree');
                  onClose();
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer rounded-sm"
              >
                <div className="flex items-center gap-2">
                  <FolderTree className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                  <span>File List: Tree Layout</span>
                </div>
                {fileListLayout === 'tree' && <Check className="w-3.5 h-3.5 text-text" />}
              </button>

              <div className="my-1 border-t border-surface0" />
            </>
          )}

          <button
            type="button"
            onClick={() => {
              toggleTheme();
              onClose();
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer rounded-sm"
          >
            <div className="flex items-center gap-2">
              <SunMoon className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
              <span>Toggle Theme</span>
            </div>
            <span className="text-[10px] text-subtext0 font-mono capitalize">
              {themeMode}
            </span>
          </button>

          <div className="my-1 border-t border-surface0" />

          <div
            className="relative"
            onMouseEnter={() => setShowPerformanceSubmenu(true)}
            onMouseLeave={() => setShowPerformanceSubmenu(false)}
          >
            <button
              type="button"
              onClick={() => setShowPerformanceSubmenu((prev) => !prev)}
              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer rounded-sm"
              aria-haspopup="menu"
              aria-expanded={showPerformanceSubmenu}
            >
              <div className="flex items-center gap-2">
                <HeartPulse className="w-3.5 h-3.5 text-primary group-hover:text-primary transition-colors" />
                <span>Performance</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-subtext0" />
            </button>

            {showPerformanceSubmenu && (
              <div className="absolute left-full top-0 w-60 shadow-2xl bg-mantle border border-surface0 py-1.5 z-50 text-xs rounded-sm">
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={isPerformanceMonitorEnabled}
                  onClick={() => {
                    togglePerformanceMonitor();
                    onClose();
                  }}
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer rounded-sm"
                >
                  <div className="flex items-center gap-2">
                    <HeartPulse className="w-3.5 h-3.5 text-primary group-hover:text-primary transition-colors" />
                    <span>Display Perf Monitor</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-subtext0 font-mono">{shortcut('Ctrl+Shift+F12')}</span>
                    {isPerformanceMonitorEnabled && <Check className="w-3.5 h-3.5 text-text" />}
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

