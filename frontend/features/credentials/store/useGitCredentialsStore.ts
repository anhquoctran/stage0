import { getApplicationServices } from '../../../core/services/runtime/applicationRuntime';
import { create } from 'zustand';

import { type SaveGitCredentialPayload } from '../types/SaveGitCredentialPayload';
import type { GitCredentialsState } from '../types/GitCredentialsState';

export const useGitCredentialsStore = create<GitCredentialsState>((set) => ({
  credentials: [],
  osInfo: null,
  isLoading: false,
  error: null,

  clearError: () => set({ error: null }),

  fetchOsInfo: async () => {
    try {
      const info = await getApplicationServices().credentials.getKeyringInfo();
      set({ osInfo: info });
    } catch (err: unknown) {
      console.warn('Could not fetch OS Keyring info:', err);
    }
  },

  fetchCredentials: async () => {
    set({ isLoading: true, error: null });
    try {
      const list = await getApplicationServices().credentials.listGitCredentials();
      set({ credentials: list, isLoading: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message, isLoading: false });
    }
  },

  saveCredential: async (payload: SaveGitCredentialPayload) => {
    set({ isLoading: true, error: null });
    try {
      const newCred = await getApplicationServices().credentials.saveGitCredential({ payload });
      set((state) => ({
        credentials: [newCred, ...state.credentials.filter((c) => c.id !== newCred.id)],
        isLoading: false,
      }));
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message, isLoading: false });
      return false;
    }
  },

  deleteCredential: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await getApplicationServices().credentials.deleteGitCredential({ id });
      set((state) => ({
        credentials: state.credentials.filter((c) => c.id !== id),
        isLoading: false,
      }));
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message, isLoading: false });
      return false;
    }
  },

  verifyCredential: async (id: string) => {
    try {
      const exists = await getApplicationServices().credentials.verifyGitCredential({ id });
      set((state) => ({
        credentials: state.credentials.map((c) =>
          c.id === id ? { ...c, is_in_keyring: exists } : c
        ),
      }));
      return exists;
    } catch (err: unknown) {
      console.error('Failed to verify credential in keyring:', err);
      return false;
    }
  },
}));
