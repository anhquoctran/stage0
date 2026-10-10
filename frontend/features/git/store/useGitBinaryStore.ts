import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { GitBinaryInfo } from '../types/GitBinaryInfo';
import type { GitBinaryState } from '../types/GitBinaryState';

const isMockMode = (): boolean => {
  if (typeof window === 'undefined') return true;
  return (
    !(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ ||
    window.location.search.includes('mock')
  );
};

const MOCK_BINARIES: GitBinaryInfo[] = [
  {
    id: 'system-default',
    source: 'system',
    name: 'System Git (PATH)',
    path: typeof navigator !== 'undefined' && navigator.userAgent.includes('Win')
      ? 'C:\\Program Files\\Git\\cmd\\git.exe'
      : '/usr/bin/git',
    version: 'git version 2.47.1',
    is_active: true,
    is_valid: true,
  },
  {
    id: 'bundled-default',
    source: 'bundled',
    name: 'Bundled Git (Stage0 Package)',
    path: typeof navigator !== 'undefined' && navigator.userAgent.includes('Win')
      ? 'D:\\stage0\\resources\\git\\bin\\git.exe'
      : '/Applications/Stage0.app/Contents/Resources/git/bin/git',
    version: 'git version 2.46.0.stage0',
    is_active: false,
    is_valid: true,
  },
  {
    id: 'github-desktop-1',
    source: 'github_desktop',
    name: 'GitHub Desktop Git',
    path: typeof navigator !== 'undefined' && navigator.userAgent.includes('Win')
      ? 'C:\\Users\\User\\AppData\\Local\\GitHubDesktop\\app-3.4.12\\resources\\app\\git\\cmd\\git.exe'
      : '/usr/local/bin/git',
    version: 'git version 2.45.1.windows.1',
    is_active: false,
    is_valid: true,
  },
];

export const useGitBinaryStore = create<GitBinaryState>((set, get) => ({
  binaries: [],
  activeBinaryId: 'system-default',
  activeBinaryPath: 'git',
  isLoading: false,
  isScanning: false,
  error: null,

  clearError: () => set({ error: null }),

  fetchActiveBinary: async () => {
    if (isMockMode()) {
      return { id: get().activeBinaryId, path: get().activeBinaryPath };
    }
    try {
      const res = await invoke<[string, string]>('get_active_git_binary');
      const [id, path] = res;
      set({ activeBinaryId: id, activeBinaryPath: path });
      return { id, path };
    } catch (err: unknown) {
      console.warn('Failed to get active git binary:', err);
      return { id: get().activeBinaryId, path: get().activeBinaryPath };
    }
  },

  scanBinaries: async () => {
    set({ isScanning: true, error: null });
    if (isMockMode()) {
      await new Promise((r) => setTimeout(r, 350));
      const activeId = get().activeBinaryId;
      const list = MOCK_BINARIES.map((b) => ({
        ...b,
        is_active: b.id === activeId,
      }));
      set({ binaries: list, isScanning: false });
      return list;
    }
    try {
      const list = await invoke<GitBinaryInfo[]>('scan_git_binaries');
      const active = list.find((b) => b.is_active);
      const activeId = active?.id || get().activeBinaryId;
      const activePath = active?.path || get().activeBinaryPath;
      set({ binaries: list, activeBinaryId: activeId, activeBinaryPath: activePath, isScanning: false });
      return list;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg, isScanning: false });
      return [];
    }
  },

  setActiveBinary: async (id: string, path: string) => {
    set({ isLoading: true, error: null });
    if (isMockMode()) {
      await new Promise((r) => setTimeout(r, 200));
      set((state) => ({
        activeBinaryId: id,
        activeBinaryPath: path,
        binaries: state.binaries.map((b) => ({
          ...b,
          is_active: b.id === id,
        })),
        isLoading: false,
      }));
      return true;
    }
    try {
      await invoke('set_active_git_binary', { id, path });
      set((state) => ({
        activeBinaryId: id,
        activeBinaryPath: path,
        binaries: state.binaries.map((b) => ({
          ...b,
          is_active: b.id === id,
        })),
        isLoading: false,
      }));
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg, isLoading: false });
      return false;
    }
  },

  validateCustomBinary: async (path: string) => {
    set({ isLoading: true, error: null });
    if (isMockMode()) {
      await new Promise((r) => setTimeout(r, 300));
      set({ isLoading: false });
      if (!path.trim()) {
        throw new Error('Path cannot be empty');
      }
      return {
        id: `custom-${Date.now()}`,
        source: 'custom',
        name: `Custom Git (${path})`,
        path,
        version: 'git version 2.48.0.windows.1',
        is_active: false,
        is_valid: true,
      };
    }
    try {
      const info = await invoke<GitBinaryInfo>('validate_custom_git_binary', { path });
      set({ isLoading: false });
      return info;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg, isLoading: false });
      throw new Error(msg);
    }
  },

  pickGitExecutable: async () => {
    if (isMockMode()) {
      return 'C:\\Tools\\Git\\bin\\git.exe';
    }
    try {
      const picked = await invoke<string | null>('pick_git_executable');
      return picked;
    } catch (err: unknown) {
      console.warn('Failed to pick git executable:', err);
      return null;
    }
  },

  restartApp: async () => {
    if (isMockMode()) {
      window.location.reload();
      return;
    }
    try {
      await invoke('restart_app');
    } catch (err: unknown) {
      console.error('Failed to restart app via command:', err);
      window.location.reload();
    }
  },
}));
