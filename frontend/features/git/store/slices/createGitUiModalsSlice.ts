import type { StateCreator } from 'zustand';
import type { GitState } from '../../types/GitState';

export const createGitUiModalsSlice: StateCreator<
  GitState,
  [],
  [],
  Pick<
    GitState,
    | 'toastMessage'
    | 'toastLevel'
    | 'showToast'
    | 'isPullFromOpen'
    | 'isMergeFromOpen'
    | 'isRebaseFromOpen'
    | 'isGitGraphOpen'
    | 'isRemoteUrlFromOpen'
    | 'targetFileForUrl'
    | 'setIsPullFromOpen'
    | 'setIsMergeFromOpen'
    | 'setIsRebaseFromOpen'
    | 'setIsGitGraphOpen'
    | 'setIsRemoteUrlFromOpen'
    | 'isCloneModalOpen'
    | 'isRepoOverviewOpen'
    | 'setIsCloneModalOpen'
    | 'setIsRepoOverviewOpen'
    | 'setTargetFileForUrl'
  >
> = (set, get) => ({
  toastMessage: null,

  toastLevel: 'success',

  showToast: (msg, level = 'success') => {
    set({ toastMessage: msg, toastLevel: level });
    setTimeout(() => {
      if (get().toastMessage === msg) {
        set({ toastMessage: null });
      }
    }, 2500);
  },

  isPullFromOpen: false,

  isMergeFromOpen: false,

  isRebaseFromOpen: false,

  isGitGraphOpen: false,

  isRemoteUrlFromOpen: false,

  targetFileForUrl: null,

  setIsPullFromOpen: (open) => set({ isPullFromOpen: open }),

  setIsMergeFromOpen: (open) => set({ isMergeFromOpen: open }),

  setIsRebaseFromOpen: (open) => set({ isRebaseFromOpen: open }),

  setIsGitGraphOpen: (open) => set({ isGitGraphOpen: open }),

  setIsRemoteUrlFromOpen: (open) => set({ isRemoteUrlFromOpen: open }),

  isCloneModalOpen: false,

  isRepoOverviewOpen: false,

  setIsCloneModalOpen: (open) => set({ isCloneModalOpen: open }),

  setIsRepoOverviewOpen: (open) => set({ isRepoOverviewOpen: open }),

  setTargetFileForUrl: (file) => set({ targetFileForUrl: file }),
});
