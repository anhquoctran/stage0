import React, { useEffect } from 'react';
import {
  Folder,
  Download,
  Cog,
  X,
} from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { usePreferencesStore } from '../../store/usePreferencesStore';
import { AppLogo } from '../common/AppLogo';

interface WelcomeScreenProps {
  onOpenRepo?: () => void;
  onCloneRepo?: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onOpenRepo,
  onCloneRepo,
}) => {
  const {
    recentRepos,
    selectRepo,
    removeRecentRepo,
    clearRecentRepos,
    openRepoDialog,
    setIsCloneModalOpen,
  } = useGitStore();

  const { setIsPreferencesOpen } = usePreferencesStore();

  const isMac =
    typeof navigator !== 'undefined' &&
    /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const modKey = isMac ? 'Cmd-' : 'Ctrl-';

  const handleOpenLocal = () => {
    if (onOpenRepo) {
      onOpenRepo();
    } else {
      openRepoDialog();
    }
  };

  const handleClone = () => {
    if (onCloneRepo) {
      onCloneRepo();
    } else {
      setIsCloneModalOpen(true);
    }
  };

  // Last 5 recent repositories
  const recentList = recentRepos.slice(0, 5);

  // Keyboard navigation matching Zed (Ctrl-1..5 to open recent repos, Ctrl-O to open, etc.)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = isMac ? e.metaKey : e.ctrlKey;
      if (!isMod) return;

      // Ctrl-1 to Ctrl-5
      const num = parseInt(e.key, 10);
      if (!isNaN(num) && num >= 1 && num <= 5) {
        const targetRepo = recentList[num - 1];
        if (targetRepo) {
          e.preventDefault();
          selectRepo(targetRepo);
          return;
        }
      }

      // Ctrl-O
      if (e.key.toLowerCase() === 'o' && !e.shiftKey) {
        e.preventDefault();
        handleOpenLocal();
        return;
      }

      // Ctrl-Shift-O or Ctrl-Shift-C for Clone
      if (e.shiftKey && (e.key.toLowerCase() === 'o' || e.key.toLowerCase() === 'c')) {
        e.preventDefault();
        handleClone();
        return;
      }

      // Ctrl-, for Preferences (and Ctrl-Shift-T as fallback)
      if (e.key === ',' || (e.shiftKey && (e.key.toLowerCase() === 't' || e.code === 'KeyT'))) {
        e.preventDefault();
        setIsPreferencesOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [recentList, selectRepo, isMac, setIsPreferencesOpen]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-base px-6 py-12 select-none overflow-y-auto">
      {/* Zed-style Centered Container */}
      <div className="w-full max-w-lg flex flex-col">
        {/* Header: Logo and Title side-by-side (Zed style) */}
        <div className="flex items-center gap-4 mb-8">
          {/* App Logo Placeholder */}
          <AppLogo size="md" />

          <div className="flex flex-col justify-center">
            <h1 className="text-xl font-normal text-text tracking-tight leading-tight">
              Welcome back to Stage0
            </h1>
            <p className="text-xs text-subtext0 italic mt-0.5 leading-snug">
              The local-first Virtual MR sandbox
            </p>
          </div>
        </div>

        {/* Section 1: GET STARTED */}
        <div className="mb-6">
          <div className="flex items-center gap-3 text-[11px] font-mono tracking-wider text-subtext0 uppercase mb-2">
            <span>GET STARTED</span>
            <div className="flex-1 h-px bg-surface0/80" />
          </div>

          <div className="space-y-0.5">
            {/* Open local repository */}
            <div
              role="button"
              tabIndex={0}
              onClick={handleOpenLocal}
              onKeyDown={(e) => e.key === 'Enter' && handleOpenLocal()}
              className="group flex items-center justify-between py-1.5 px-2 -mx-2 rounded-md hover:bg-surface0/60 transition-colors cursor-pointer text-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Folder className="w-4 h-4 text-subtext0 group-hover:text-text transition-colors shrink-0" />
                <span className="text-subtext1 group-hover:text-text transition-colors truncate">
                  Open local repository
                </span>
              </div>
              <span className="text-[11px] font-mono text-subtext0/70 group-hover:text-subtext0 transition-colors shrink-0">
                {modKey}O
              </span>
            </div>

            {/* Clone repository */}
            <div
              role="button"
              tabIndex={0}
              onClick={handleClone}
              onKeyDown={(e) => e.key === 'Enter' && handleClone()}
              className="group flex items-center justify-between py-1.5 px-2 -mx-2 rounded-md hover:bg-surface0/60 transition-colors cursor-pointer text-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Download className="w-4 h-4 text-subtext0 group-hover:text-text transition-colors shrink-0" />
                <span className="text-subtext1 group-hover:text-text transition-colors truncate">
                  Clone repository
                </span>
              </div>
              <span className="text-[11px] font-mono text-subtext0/70 group-hover:text-subtext0 transition-colors shrink-0">
                {modKey}Shift-O
              </span>
            </div>

            {/* Preferences */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => setIsPreferencesOpen(true)}
              onKeyDown={(e) => e.key === 'Enter' && setIsPreferencesOpen(true)}
              className="group flex items-center justify-between py-1.5 px-2 -mx-2 rounded-md hover:bg-surface0/60 transition-colors cursor-pointer text-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Cog className="w-4 h-4 text-subtext0 group-hover:text-text transition-colors shrink-0" />
                <span className="text-subtext1 group-hover:text-text transition-colors truncate">
                  Open Preferences
                </span>
              </div>
              <span className="text-[11px] font-mono text-subtext0/70 group-hover:text-subtext0 transition-colors shrink-0">
                {modKey},
              </span>
            </div>
          </div>
        </div>

        {/* Section 2: RECENT PROJECTS */}
        <div>
          <div className="flex items-center gap-3 text-[11px] font-mono tracking-wider text-subtext0 uppercase mb-2">
            <span>RECENT PROJECTS</span>
            <div className="flex-1 h-px bg-surface0/80" />
            {recentList.length > 0 && (
              <button
                type="button"
                onClick={clearRecentRepos}
                className="text-[10px] lowercase text-subtext0/70 hover:text-red transition-colors cursor-pointer px-1 py-0.5 rounded hover:bg-surface0"
                title="Clear all recent repositories"
              >
                clear all
              </button>
            )}
          </div>

          <div className="space-y-0.5">
            {recentList.length === 0 ? (
              <div className="py-2 px-2 text-xs text-subtext0 italic">
                No recent repositories
              </div>
            ) : (
              recentList.map((repo, idx) => (
                <div
                  key={repo.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => selectRepo(repo)}
                  onKeyDown={(e) => e.key === 'Enter' && selectRepo(repo)}
                  className="group flex items-center justify-between py-1.5 px-2 -mx-2 rounded-md hover:bg-surface0/60 transition-colors cursor-pointer text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-3">
                    <Folder className="w-4 h-4 text-subtext0 group-hover:text-text transition-colors shrink-0" />
                    <span
                      className="text-subtext1 group-hover:text-text transition-colors truncate"
                      title={repo.local_path}
                    >
                      {repo.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeRecentRepo(repo.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-subtext0 hover:text-red transition-all cursor-pointer"
                      title="Remove from recents"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <span className="text-[11px] font-mono text-subtext0/70 group-hover:text-subtext0 transition-colors">
                      {modKey}{idx + 1}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
