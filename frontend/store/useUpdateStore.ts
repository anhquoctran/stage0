import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { SOFTWARE_ABOUT } from '../config/about';
import { useGitStore } from './useGitStore';
import {
  UpdatePayload,
  UpdateStatus,
  MockScenario,
  UpdateCheckParams,
  UpdateCheckPolicy,
  UpdateCheckFrequency,
} from '../types/update';
import {
  fetchUpdateCheck,
  simulateDownloadPayload,
} from '../services/updateApi';

const POLICY_STORAGE_KEY = 'stage0_update_policy';
const FREQUENCY_STORAGE_KEY = 'stage0_update_frequency';

function getInitialPolicy(): UpdateCheckPolicy {
  if (typeof window === 'undefined') return 'notify_only';
  const val = localStorage.getItem(POLICY_STORAGE_KEY);
  if (val === 'disabled' || val === 'notify_only' || val === 'auto_install') {
    return val;
  }
  return 'notify_only';
}

function getInitialFrequency(): UpdateCheckFrequency {
  if (typeof window === 'undefined') return 'daily';
  const val = localStorage.getItem(FREQUENCY_STORAGE_KEY);
  if (val === 'daily' || val === 'weekly' || val === 'monthly') {
    return val;
  }
  return 'daily';
}

interface UpdateStoreState {
  status: UpdateStatus;
  isModalOpen: boolean;
  updatePayload: UpdatePayload | null;
  downloadProgress: number;
  downloadSpeed: string;
  downloadedText: string;
  errorMessage: string | null;
  mockScenario: MockScenario;
  lastCheckedTime: string | null;
  updateCheckPolicy: UpdateCheckPolicy;
  updateCheckFrequency: UpdateCheckFrequency;

  // Actions
  setMockScenario: (scenario: MockScenario) => void;
  setUpdateCheckPolicy: (policy: UpdateCheckPolicy) => void;
  setUpdateCheckFrequency: (frequency: UpdateCheckFrequency) => void;
  openModal: () => void;
  closeModal: () => void;
  checkForUpdates: (manualTrigger?: boolean) => Promise<void>;
  checkIfUpdateDueAndRun: () => Promise<void>;
  startDownload: () => void;
  cancelDownload: () => void;
  applyUpdateAndRestart: () => Promise<void>;
  reset: () => void;
}

let activeDownloadCancel: (() => void) | null = null;

export const useUpdateStore = create<UpdateStoreState>((set, get) => ({
  status: 'idle',
  isModalOpen: false,
  updatePayload: null,
  downloadProgress: 0,
  downloadSpeed: '',
  downloadedText: '',
  errorMessage: null,
  mockScenario: 'available',
  lastCheckedTime: null,
  updateCheckPolicy: getInitialPolicy(),
  updateCheckFrequency: getInitialFrequency(),

  setMockScenario: (scenario) => {
    set({ mockScenario: scenario });
  },

  setUpdateCheckPolicy: (policy) => {
    try {
      localStorage.setItem(POLICY_STORAGE_KEY, policy);
    } catch {}
    set({ updateCheckPolicy: policy });
  },

  setUpdateCheckFrequency: (frequency) => {
    try {
      localStorage.setItem(FREQUENCY_STORAGE_KEY, frequency);
    } catch {}
    set({ updateCheckFrequency: frequency });
  },

  openModal: () => {
    set({ isModalOpen: true });
    // If opening when idle, automatically initiate check
    if (get().status === 'idle') {
      void get().checkForUpdates(true);
    }
  },

  closeModal: () => {
    // If downloading, don't abruptly kill unless user cancels
    set({ isModalOpen: false });
  },

  checkForUpdates: async (manualTrigger = true) => {
    if (manualTrigger) {
      set({ isModalOpen: true });
    }

    set({
      status: 'checking',
      errorMessage: null,
      downloadProgress: 0,
      downloadSpeed: '',
      downloadedText: '',
    });

    try {
      const params: UpdateCheckParams = {
        current_version: SOFTWARE_ABOUT.packageVersion || '0.1.0',
        os_name: (SOFTWARE_ABOUT.os || 'windows').toLowerCase(),
        arch_name: (SOFTWARE_ABOUT.arch || 'amd64').toLowerCase(),
      };

      const response = await fetchUpdateCheck(params, get().mockScenario);

      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      if (response.code === 'UPDATE_AVAILABLE' && response.data?.downloadUrl) {
        try {
          localStorage.setItem('stage0_update_last_check_ts', String(Date.now()));
        } catch {}

        set({
          status: 'available',
          updatePayload: response.data,
          lastCheckedTime: now,
        });

        // Background auto check actions
        if (!manualTrigger) {
          const latest = response.data.latestVersion;
          if (get().updateCheckPolicy === 'notify_only') {
            useGitStore.getState().showToast(`Stage0 v${latest} is available! Open Preferences to update.`);
          } else if (get().updateCheckPolicy === 'auto_install') {
            useGitStore.getState().showToast(`Stage0 v${latest} is downloading automatically.`);
            get().startDownload();
          }
        }
      } else if (response.code === 'UP_TO_DATE') {
        try {
          localStorage.setItem('stage0_update_last_check_ts', String(Date.now()));
        } catch {}

        set({
          status: 'up-to-date',
          updatePayload: response.data || null,
          lastCheckedTime: now,
        });
      } else {
        if (manualTrigger) {
          set({
            status: 'error',
            errorMessage: response.message || 'Unable to retrieve updates at this time.',
            lastCheckedTime: now,
          });
        } else {
          // Industry standard (VS Code / Sparkle): background check fails silently
          console.debug('[UpdateService] Background check failed silently:', response.message);
          set({ status: 'idle' });
        }
      }
    } catch (err) {
      if (manualTrigger) {
        set({
          status: 'error',
          errorMessage: err instanceof Error ? err.message : 'Unknown network error occurred while checking for updates.',
        });
      } else {
        // Industry standard: background network errors fail silently without disturbing the user
        console.debug('[UpdateService] Background check network error:', err);
        set({ status: 'idle' });
      }
    }
  },

  checkIfUpdateDueAndRun: async () => {
    const policy = get().updateCheckPolicy;
    if (policy === 'disabled') return;

    // Do not interrupt an active check or download
    if (get().status === 'checking' || get().status === 'downloading' || get().status === 'ready') {
      return;
    }

    const frequency = get().updateCheckFrequency;
    const intervalMap: Record<UpdateCheckFrequency, number> = {
      daily: 24 * 60 * 60 * 1000,
      weekly: 7 * 24 * 60 * 60 * 1000,
      monthly: 30 * 24 * 60 * 60 * 1000,
    };

    const interval = intervalMap[frequency] || intervalMap.daily;
    let lastCheck = 0;
    try {
      const lastCheckStr = localStorage.getItem('stage0_update_last_check_ts');
      lastCheck = lastCheckStr ? parseInt(lastCheckStr, 10) : 0;
    } catch {}

    const now = Date.now();
    // If it has never run before (lastCheck === 0) or the interval has elapsed
    if (lastCheck === 0 || now - lastCheck >= interval) {
      void get().checkForUpdates(false);
    }
  },

  startDownload: () => {
    const { updatePayload } = get();
    if (!updatePayload) return;

    if (activeDownloadCancel) {
      activeDownloadCancel();
      activeDownloadCancel = null;
    }

    set({
      status: 'downloading',
      downloadProgress: 0,
      downloadSpeed: 'Calculating...',
      downloadedText: '0 MB / 48.6 MB',
      errorMessage: null,
    });

    activeDownloadCancel = simulateDownloadPayload(
      (percent, speed, downloadedBytes) => {
        set({
          downloadProgress: percent,
          downloadSpeed: speed,
          downloadedText: downloadedBytes,
        });
      },
      () => {
        activeDownloadCancel = null;
        set({
          status: 'ready',
          downloadProgress: 100,
          downloadSpeed: 'Completed',
        });
        if (get().updateCheckPolicy === 'auto_install') {
          useGitStore.getState().showToast('Stage0 update is ready to install! Restart when convenient.');
        }
      },
      (errorMsg) => {
        activeDownloadCancel = null;
        set({
          status: 'error',
          errorMessage: errorMsg,
        });
      }
    );
  },

  cancelDownload: () => {
    if (activeDownloadCancel) {
      activeDownloadCancel();
      activeDownloadCancel = null;
    }
    set({
      status: 'available',
      downloadProgress: 0,
      downloadSpeed: '',
      downloadedText: '',
    });
  },

  applyUpdateAndRestart: async () => {
    try {
      console.log('[UpdateStore] Applying update and initiating restart...');
      // Try invoking native desktop restart command
      await invoke('restart_app');
    } catch {
      // In web browser or mock environment, reload window
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    }
  },

  reset: () => {
    if (activeDownloadCancel) {
      activeDownloadCancel();
      activeDownloadCancel = null;
    }
    set({
      status: 'idle',
      updatePayload: null,
      downloadProgress: 0,
      downloadSpeed: '',
      downloadedText: '',
      errorMessage: null,
    });
  },
}));
