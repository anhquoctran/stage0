import { invoke } from '@tauri-apps/api/core';
import type { StateCreator } from 'zustand';
import { type ConflictFilePreview } from '../../types/ConflictFilePreview';
import { type FileBlamePayload } from '../../types/FileBlamePayload';
import type { GitState } from '../../types/GitState';

export const createGitConflictBlameSlice: StateCreator<
  GitState,
  [],
  [],
  Pick<
    GitState,
    | 'fileViewTab'
    | 'blamePayload'
    | 'isBlameLoading'
    | 'blameError'
    | 'blameRevision'
    | 'blameIgnoreWhitespace'
    | 'activeConflictPreview'
    | 'isConflictLoading'
    | 'conflictPreviewError'
    | 'setFileViewTab'
    | 'fetchConflictPreview'
    | 'setBlameRevision'
    | 'setBlameIgnoreWhitespace'
    | 'fetchFileBlame'
    | 'toggleFileBlame'
  >
> = (set, get) => ({
  fileViewTab: 'diff',

  blamePayload: null,

  isBlameLoading: false,

  blameError: null,

  blameRevision: '',

  blameIgnoreWhitespace: false,

  activeConflictPreview: null,

  isConflictLoading: false,

  conflictPreviewError: null,

  setFileViewTab: (tab: 'diff' | 'blame' | 'conflicts') => {
    const { selectedFile } = get();
    if (selectedFile?.is_binary && tab !== 'diff') {
      set({ fileViewTab: 'diff' });
      return;
    }
    set({ fileViewTab: tab });
    if (tab === 'blame') {
      get().fetchFileBlame();
    } else if (tab === 'conflicts' && get().selectedFile?.is_conflicted) {
      get().fetchConflictPreview();
    }
  },

  fetchConflictPreview: async (filePath?: string) => {
    const { currentRepo, baseBranch, compareBranch, selectedFile } = get();
    const targetFile = filePath || selectedFile?.path;
    if (!currentRepo || !baseBranch || !compareBranch || !targetFile) return;

    set({ isConflictLoading: true, conflictPreviewError: null });
    try {
      const preview = await invoke<ConflictFilePreview>('get_conflicted_file_preview', {
        repoPath: currentRepo.local_path,
        base: baseBranch,
        compare: compareBranch,
        filePath: targetFile,
      });
      set({ activeConflictPreview: preview });
    } catch (err: unknown) {
      console.warn('Failed to load conflict preview:', err);
      set({ conflictPreviewError: String(err) });
    } finally {
      set({ isConflictLoading: false });
    }
  },

  setBlameRevision: (rev: string) => {
    set({ blameRevision: rev });
    get().fetchFileBlame(undefined, rev);
  },

  setBlameIgnoreWhitespace: (ignore: boolean) => {
    set({ blameIgnoreWhitespace: ignore });
    get().fetchFileBlame(undefined, undefined, ignore);
  },

  fetchFileBlame: async (filePath?: string, revision?: string, ignoreWhitespace?: boolean) => {
    const { currentRepo, selectedFile, compareBranch, blameRevision, blameIgnoreWhitespace } =
      get();
    const targetFile = filePath || selectedFile?.path;
    if (!currentRepo || !targetFile) return;
    if (selectedFile?.path === targetFile && selectedFile.is_binary) {
      set({ isBlameLoading: false, blameError: null, blamePayload: null });
      return;
    }

    const rev = revision !== undefined ? revision : blameRevision || compareBranch || 'HEAD';
    const ignoreWs = ignoreWhitespace !== undefined ? ignoreWhitespace : blameIgnoreWhitespace;

    set({
      isBlameLoading: true,
      blameError: null,
      blameRevision: rev,
      blameIgnoreWhitespace: ignoreWs,
    });
    try {
      const payload = await invoke<FileBlamePayload>('get_file_blame', {
        repoPath: currentRepo.local_path,
        filePath: targetFile,
        revision: rev || null,
        ignoreWhitespace: ignoreWs,
      });
      set({ blamePayload: payload, isBlameLoading: false });
    } catch (err: unknown) {
      console.warn('Failed to fetch file blame:', err);
      set({ blameError: String(err), isBlameLoading: false, blamePayload: null });
    }
  },

  toggleFileBlame: () => {
    const currentTab = get().fileViewTab;
    const nextTab = currentTab === 'diff' ? 'blame' : 'diff';
    get().setFileViewTab(nextTab);
  },
});
