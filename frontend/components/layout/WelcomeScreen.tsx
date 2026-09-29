import React from 'react';
import {
  FolderOpen,
  Download,
  FolderGit2,
  Clock,
  Trash2,
  ChevronRight,
  Plus,
  Sparkles,
} from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';

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
    openRepoDialog,
    setIsCloneModalOpen,
    isLoading,
  } = useGitStore();

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

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-base px-6 py-10 select-none overflow-y-auto">
      {/* Container with max width */}
      <div className="w-full max-w-3xl flex flex-col items-center">
        {/* Brand Hero */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-mantle border border-surface0/80 shadow-2xl flex items-center justify-center text-blue mb-4 relative group">
            <div className="absolute -inset-1.5 bg-gradient-to-tr from-blue/20 via-mauve/20 to-teal/20 rounded-2xl blur-md opacity-60 group-hover:opacity-100 transition-opacity" />
            <svg
              className="w-10 h-10 relative z-10"
              viewBox="0 0 128 128"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="hero-trunk" x1="0" y1="0" x2="0" y2="128" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#89b4fa" />
                  <stop offset="100%" stopColor="#74c7ec" />
                </linearGradient>
                <linearGradient id="hero-branch" x1="44" y1="42" x2="84" y2="92" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#cba6f7" />
                  <stop offset="100%" stopColor="#a6e3a1" />
                </linearGradient>
              </defs>
              <path d="M44 26 V102" stroke="#45475a" strokeWidth="6" strokeLinecap="round" />
              <path d="M44 42 V86" stroke="url(#hero-trunk)" strokeWidth="6" strokeLinecap="round" />
              <path
                d="M44 42 C44 58, 84 52, 84 66 C84 80, 44 76, 44 92"
                stroke="url(#hero-branch)"
                strokeWidth="6"
                strokeLinecap="round"
                fill="none"
              />
              <circle cx="44" cy="36" r="8" fill="#1e1e2e" stroke="#89b4fa" strokeWidth="5" />
              <circle cx="44" cy="94" r="8" fill="#1e1e2e" stroke="#a6e3a1" strokeWidth="5" />
              <circle cx="84" cy="66" r="9" fill="#181825" stroke="#cba6f7" strokeWidth="5" />
              <circle cx="84" cy="66" r="4" fill="#cba6f7" />
              <circle cx="44" cy="94" r="3" fill="#a6e3a1" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-text mb-2">
            Welcome to Stage0
          </h1>
          <p className="text-xs text-subtext1 max-w-lg leading-relaxed">
            Stage0 provides a local-first Virtual MR / PR Sandbox. Inspect branch differences, 3-dot diffs, and real-time merge conflict predictions with zero disk writes.
          </p>
        </div>

        {/* 2-Column Grid: Get Started & Recents */}
        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* Section 1: Get Started */}
          <div className="bg-mantle/70 border border-surface0/90 rounded-xl p-5 shadow-lg flex flex-col h-full">
            <div className="flex items-center gap-2 mb-4 pb-2.5 border-b border-surface0">
              <Sparkles className="w-4 h-4 text-blue" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-text">
                Get Started
              </h2>
            </div>

            <div className="space-y-3 flex-1 flex flex-col justify-start">
              {/* Option 1: Open local repository */}
              <button
                type="button"
                onClick={handleOpenLocal}
                disabled={isLoading}
                className="w-full group flex items-start gap-3 p-3.5 rounded-xl bg-surface0/50 hover:bg-surface1/80 border border-surface1 hover:border-blue/50 text-left transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-50"
              >
                <div className="p-2.5 rounded-lg bg-blue/10 text-blue border border-blue/20 group-hover:bg-blue group-hover:text-crust transition-colors shrink-0">
                  <FolderOpen className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-text group-hover:text-blue transition-colors flex items-center gap-1.5">
                      <Plus className="w-3.5 h-3.5 text-subtext0 group-hover:text-blue" />
                      Open local repository
                    </span>
                    <span className="text-[10px] text-subtext0 font-mono bg-surface1 px-1.5 py-0.5 rounded border border-surface2">
                      Ctrl+O
                    </span>
                  </div>
                  <p className="text-[11px] text-subtext0 mt-1 leading-snug">
                    Select an existing Git repository from your local file system
                  </p>
                </div>
              </button>

              {/* Option 2: Clone repository */}
              <button
                type="button"
                onClick={handleClone}
                disabled={isLoading}
                className="w-full group flex items-start gap-3 p-3.5 rounded-xl bg-surface0/50 hover:bg-surface1/80 border border-surface1 hover:border-blue/50 text-left transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-50"
              >
                <div className="p-2.5 rounded-lg bg-teal/10 text-teal border border-teal/20 group-hover:bg-teal group-hover:text-crust transition-colors shrink-0">
                  <Download className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-text group-hover:text-teal transition-colors flex items-center gap-1.5">
                      <Plus className="w-3.5 h-3.5 text-subtext0 group-hover:text-teal" />
                      Clone repository
                    </span>
                  </div>
                  <p className="text-[11px] text-subtext0 mt-1 leading-snug">
                    Clone from GitHub, GitLab, Bitbucket or any remote Git URL
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Section 2: Recents */}
          <div className="bg-mantle/70 border border-surface0/90 rounded-xl p-5 shadow-lg flex flex-col h-full">
            <div className="flex items-center justify-between mb-4 pb-2.5 border-b border-surface0">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-mauve" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-text">
                  Recents
                </h2>
              </div>
              <span className="text-[10px] text-subtext0 font-mono">
                {recentList.length > 0 ? `${recentList.length} of ${recentRepos.length}` : '0'}
              </span>
            </div>

            <div className="space-y-2 flex-1 flex flex-col justify-start">
              {recentList.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center rounded-lg border border-dashed border-surface1 bg-surface0/20">
                  <FolderGit2 className="w-8 h-8 text-subtext0/60 mb-2" />
                  <p className="text-xs font-medium text-text mb-0.5">No recent repositories</p>
                  <p className="text-[11px] text-subtext0 leading-tight">
                    Open or clone a repository to get started quickly.
                  </p>
                </div>
              ) : (
                recentList.map((repo) => (
                  <div
                    key={repo.id}
                    onClick={() => selectRepo(repo)}
                    className="group flex items-center justify-between p-2.5 rounded-lg bg-surface0/40 hover:bg-surface1/90 border border-surface0 hover:border-surface2 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="p-1.5 rounded-md bg-surface1 group-hover:bg-blue/15 text-subtext1 group-hover:text-blue transition-colors shrink-0">
                        <FolderGit2 className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-text truncate group-hover:text-blue transition-colors">
                          {repo.name}
                        </div>
                        <div
                          className="text-[10px] text-subtext0 font-mono truncate"
                          title={repo.local_path}
                        >
                          {repo.local_path}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeRecentRepo(repo.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-surface2 text-subtext0 hover:text-red transition-all cursor-pointer"
                        title="Remove from recents"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <ChevronRight className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
