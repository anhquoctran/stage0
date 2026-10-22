import { create } from 'zustand';
import type { GitState } from '../types/GitState';
import { createGitConflictBlameSlice } from './slices/createGitConflictBlameSlice';
import { createGitDiffSlice } from './slices/createGitDiffSlice';
import { createGitRepoSlice } from './slices/createGitRepoSlice';
import { createGitSandboxSlice } from './slices/createGitSandboxSlice';
import { createGitSyncSlice } from './slices/createGitSyncSlice';
import { createGitUiModalsSlice } from './slices/createGitUiModalsSlice';

// Keep the public hook and its selectors stable; slices share this single store.
export const useGitStore = create<GitState>((...args) => ({
  ...createGitSandboxSlice(...args),
  ...createGitConflictBlameSlice(...args),
  ...createGitUiModalsSlice(...args),
  ...createGitDiffSlice(...args),
  ...createGitSyncSlice(...args),
  ...createGitRepoSlice(...args),
}));
