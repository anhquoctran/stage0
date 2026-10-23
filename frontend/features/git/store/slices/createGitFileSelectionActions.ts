import type { StoreApi } from 'zustand';
import { type ChangedFile } from '../../types/ChangedFile';
import type { GitState } from '../../types/GitState';
export const createGitFileSelectionActions = (
  set: StoreApi<GitState>['setState'],
  get: StoreApi<GitState>['getState']
): Pick<
  GitState,
  | 'selectFile'
  | 'selectNextFile'
  | 'selectPrevFile'
  | 'selectNextConflictFile'
  | 'selectPrevConflictFile'
> => ({
  selectFile: (file: ChangedFile | null) => {
    set({
      selectedFile: file,
      activeConflictPreview: null,
      ...(file?.is_binary && get().fileViewTab !== 'diff' ? { fileViewTab: 'diff' as const } : {}),
    });
    if (file) {
      if (file.is_conflicted && !file.is_binary) {
        get().fetchConflictPreview(file.path);
      }
      if (get().fileViewTab === 'blame' && !file.is_binary) {
        get().fetchFileBlame(file.path);
      }
    }
  },

  selectNextFile: () => {
    const { diffPayload, selectedFile } = get();
    if (!diffPayload || diffPayload.files.length === 0) return;
    if (!selectedFile) {
      const first = diffPayload.files[0];
      set({
        selectedFile: first,
        ...(first.is_binary && get().fileViewTab !== 'diff'
          ? { fileViewTab: 'diff' as const }
          : {}),
      });
      if (get().fileViewTab === 'blame' && !first.is_binary) {
        get().fetchFileBlame(first.path);
      }
      return;
    }
    const idx = diffPayload.files.findIndex((f) => f.path === selectedFile.path);
    if (idx !== -1 && idx < diffPayload.files.length - 1) {
      const next = diffPayload.files[idx + 1];
      set({
        selectedFile: next,
        ...(next.is_binary && get().fileViewTab !== 'diff' ? { fileViewTab: 'diff' as const } : {}),
      });
      if (get().fileViewTab === 'blame' && !next.is_binary) {
        get().fetchFileBlame(next.path);
      }
    }
  },

  selectPrevFile: () => {
    const { diffPayload, selectedFile } = get();
    if (!diffPayload || diffPayload.files.length === 0) return;
    if (!selectedFile) {
      const first = diffPayload.files[0];
      set({
        selectedFile: first,
        ...(first.is_binary && get().fileViewTab !== 'diff'
          ? { fileViewTab: 'diff' as const }
          : {}),
      });
      if (get().fileViewTab === 'blame' && !first.is_binary) {
        get().fetchFileBlame(first.path);
      }
      return;
    }
    const idx = diffPayload.files.findIndex((f) => f.path === selectedFile.path);
    if (idx > 0) {
      const prev = diffPayload.files[idx - 1];
      set({
        selectedFile: prev,
        ...(prev.is_binary && get().fileViewTab !== 'diff' ? { fileViewTab: 'diff' as const } : {}),
      });
      if (get().fileViewTab === 'blame' && !prev.is_binary) {
        get().fetchFileBlame(prev.path);
      }
    }
  },

  selectNextConflictFile: () => {
    const { diffPayload, selectedFile } = get();
    if (!diffPayload || diffPayload.files.length === 0) return;
    const conflicted = diffPayload.files.filter((f) => f.is_conflicted && !f.is_binary);
    if (conflicted.length === 0) return;

    if (!selectedFile || !selectedFile.is_conflicted || selectedFile.is_binary) {
      get().selectFile(conflicted[0]);
      return;
    }

    const currentIdx = conflicted.findIndex((f) => f.path === selectedFile.path);
    const nextIdx = (currentIdx + 1) % conflicted.length;
    get().selectFile(conflicted[nextIdx]);
  },

  selectPrevConflictFile: () => {
    const { diffPayload, selectedFile } = get();
    if (!diffPayload || diffPayload.files.length === 0) return;
    const conflicted = diffPayload.files.filter((f) => f.is_conflicted && !f.is_binary);
    if (conflicted.length === 0) return;

    if (!selectedFile || !selectedFile.is_conflicted || selectedFile.is_binary) {
      get().selectFile(conflicted[conflicted.length - 1]);
      return;
    }

    const currentIdx = conflicted.findIndex((f) => f.path === selectedFile.path);
    const prevIdx = (currentIdx - 1 + conflicted.length) % conflicted.length;
    get().selectFile(conflicted[prevIdx]);
  },
});
