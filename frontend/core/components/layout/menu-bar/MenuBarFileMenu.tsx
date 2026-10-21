import React, { useState } from 'react';
import { Columns2 } from '../../../../common/components/icons/Columns2';
import { FolderOpen } from '../../../../common/components/icons/FolderOpen';
import { Monitor } from '../../../../common/components/icons/Monitor';
import { FolderGit2 } from '../../../../common/components/icons/FolderGit2';
import { Clock } from '../../../../common/components/icons/Clock';
import { ChevronRight } from '../../../../common/components/icons/ChevronRight';
import { Check } from '../../../../common/components/icons/Check';
import { Trash2 } from '../../../../common/components/icons/Trash2';
import { FolderX } from '../../../../common/components/icons/FolderX';
import { Cog } from '../../../../common/components/icons/Cog';
import { Power } from '../../../../common/components/icons/Power';
import { invoke } from '@tauri-apps/api/core';
import { useGitStore } from '../../../../features/git/store/useGitStore';
import { usePreferencesStore } from '../../../../features/preferences/store/usePreferencesStore';

export const MenuBarFileMenu: React.FC<{
  isOpen: boolean;
  onToggle: () => void;
  onHover: () => void;
  onClose: () => void;
  shortcut: (value: string) => string;
}> = ({ isOpen, onToggle, onHover, onClose, shortcut }) => {
  const {
    currentRepo,
    recentRepos,
    openRepoDialog,
    setIsCloneModalOpen,
    selectRepo,
    clearRecentRepos,
    removeRecentRepo,
    closeRepo,
  } = useGitStore();

  const { setIsPreferencesOpen } = usePreferencesStore();
  const [showRecentSubmenu, setShowRecentSubmenu] = useState(false);

  const handleExitApp = async () => {
    onClose();
    try {
      await invoke('window_close');
    } catch {
      window.close();
    }
  };

  return (
    <div className="relative h-full flex items-center">
      <button
        type="button"
        onClick={onToggle}
        onMouseEnter={onHover}
        className={`px-2.5 py-1 text-xs font-normal transition-colors cursor-pointer ${
          isOpen
            ? 'bg-surface1 text-text'
            : 'text-subtext1 hover:text-text hover:bg-surface0'
        }`}
      >
        File
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-0.5 w-64 shadow-2xl bg-mantle border border-surface0 py-1.5 z-50 text-xs">
          <button
            type="button"
            onClick={() => {
              onClose();
              void invoke('create_new_window');
            }}
            onMouseEnter={() => setShowRecentSubmenu(false)}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer"
          >
            <Columns2 className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
            <span>New Window</span>
            <span className="ml-auto text-[10px] text-subtext0 font-mono">{shortcut('Ctrl+Shift+N')}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              openRepoDialog();
            }}
            onMouseEnter={() => setShowRecentSubmenu(false)}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <FolderOpen className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
              <span>Open...</span>
            </div>
            <span className="text-[10px] text-subtext0 font-mono">{shortcut('Ctrl+O')}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              openRepoDialog(true);
            }}
            onMouseEnter={() => setShowRecentSubmenu(false)}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Monitor className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
              <span>Open in New Window...</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              setIsCloneModalOpen(true);
            }}
            onMouseEnter={() => setShowRecentSubmenu(false)}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <FolderGit2 className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
              <span>Clone...</span>
            </div>
            <span className="text-[10px] text-subtext0 font-mono">
              {shortcut('Ctrl+Shift+O')}
            </span>
          </button>

          {/* Recent Repos Submenu Trigger */}
          <div
            className="relative"
            onMouseEnter={() => setShowRecentSubmenu(true)}
            onMouseLeave={() => setShowRecentSubmenu(false)}
          >
            <button
              type="button"
              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                <span>Recents</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
            </button>

            {showRecentSubmenu && (
              <div className="absolute left-full top-0 ml-0.5 w-80 shadow-2xl bg-mantle border border-surface0 py-1.5 z-50 text-xs max-h-72 overflow-y-auto">
                {recentRepos.length === 0 ? (
                  <div className="px-3 py-2 text-subtext0 text-center italic">
                    No recent repositories
                  </div>
                ) : (
                  recentRepos.map((repo) => (
                    <div
                      key={repo.id}
                      onClick={() => {
                        selectRepo(repo);
                        onClose();
                      }}
                      className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="font-medium truncate text-text flex items-center gap-1.5">
                          <FolderOpen className="w-3 h-3 text-subtext0 shrink-0" />
                          <span className="truncate">{repo.name}</span>
                        </div>
                        <div className="text-[10px] text-subtext0 truncate font-mono">
                          {repo.local_path}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {currentRepo?.id === repo.id && (
                          <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeRecentRepo(repo.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-surface2 text-subtext0 hover:text-red transition-all cursor-pointer"
                          title="Remove from recent repositories"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
                {recentRepos.length > 0 && (
                  <>
                    <div className="my-1 border-t border-surface0" />
                    <button
                      type="button"
                      onClick={() => {
                        clearRecentRepos();
                        onClose();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-subtext0 hover:text-red hover:bg-surface1 text-left transition-colors group cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-subtext0 group-hover:text-red transition-colors" />
                      <span>Clear Recently Opened</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="my-1 border-t border-surface0" />

          <button
            type="button"
            disabled={!currentRepo}
            onClick={() => {
              closeRepo();
              onClose();
            }}
            onMouseEnter={() => setShowRecentSubmenu(false)}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors disabled:opacity-40 disabled:hover:bg-transparent group cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <FolderX className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
              <span>Close Repository</span>
            </div>
          </button>

          <div className="my-1 border-t border-surface0" />

          <button
            type="button"
            onClick={() => {
              onClose();
              setIsPreferencesOpen(true);
            }}
            onMouseEnter={() => setShowRecentSubmenu(false)}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Cog className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
              <span>Preferences...</span>
            </div>
            <span className="text-[10px] text-subtext0 font-mono">
              {shortcut('Ctrl+,')}
            </span>
          </button>

          <div className="my-1 border-t border-surface0" />

          <button
            type="button"
            onClick={handleExitApp}
            onMouseEnter={() => setShowRecentSubmenu(false)}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Power className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
              <span>Exit</span>
            </div>
            <span className="text-[10px] text-subtext0 font-mono">{shortcut('Alt+F4')}</span>
          </button>
        </div>
      )}
    </div>
  );
};

