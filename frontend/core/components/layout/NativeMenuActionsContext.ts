import React from 'react';
import type { GitSyncOperation } from '../../../features/git/types/GitSyncOperation';
import type { GitSyncOptions } from '../../../features/git/types/GitSyncOptions';
import type { ViewMode } from '../../../features/git/types/ViewMode';

export interface NativeMenuActionsContext {
  openRepoDialog: (forceNewWindow?: boolean) => Promise<void>;
  setIsCloneModalOpen: (open: boolean) => void;
  closeRepo: () => Promise<void>;
  setIsPreferencesOpen: (open: boolean) => void;
  openNewMrDraft: (baseBranch?: string, compareBranch?: string) => Promise<void>;
  runSync: (op: GitSyncOperation, options?: GitSyncOptions) => Promise<void>;
  setIsPullFromOpen: (open: boolean) => void;
  setIsMergeFromOpen: (open: boolean) => void;
  setIsRebaseFromOpen: (open: boolean) => void;
  setIsGitGraphOpen: (open: boolean) => void;
  openRepoSettings: (tab?: 'remotes' | 'branches' | 'labels' | 'agents') => void;
  setViewMode: (mode: ViewMode) => void;
  toggleFileBlame: () => void;
  toggleInlineBlame: () => void;
  togglePerformanceMonitor: () => void;
  setShowShortcutsModal: React.Dispatch<React.SetStateAction<boolean>>;
  setShowAboutModal: React.Dispatch<React.SetStateAction<boolean>>;
}
