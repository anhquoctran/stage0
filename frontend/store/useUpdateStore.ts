import { create } from 'zustand';
import type {
  LatestRelease,
  UpdateChannel,
  UpdateCheckFrequency,
  UpdateCheckPolicy,
  UpdateDownloadProgress,
  UpdateStatus,
} from '../types/update';
import {
  cancelUpdateDownload,
  checkForUpdate,
  downloadUpdate,
  installUpdate,
} from '../services/updateApi';
import { notificationService } from '../services/notificationService';

const POLICY_STORAGE_KEY = 'stage0_update_policy';
const FREQUENCY_STORAGE_KEY = 'stage0_update_frequency';
const CHANNEL_STORAGE_KEY = 'stage0_update_channel';
const LAST_CHECK_STORAGE_KEY = 'stage0_update_last_check_ts';
let updateCheckGeneration = 0;

function getInitialPolicy(): UpdateCheckPolicy {
  if (typeof window === 'undefined') return 'notify_only';
  const value = localStorage.getItem(POLICY_STORAGE_KEY);
  return value === 'disabled' || value === 'notify_only' || value === 'auto_install'
    ? value
    : 'notify_only';
}

function getInitialFrequency(): UpdateCheckFrequency {
  if (typeof window === 'undefined') return 'daily';
  const value = localStorage.getItem(FREQUENCY_STORAGE_KEY);
  return value === 'daily' || value === 'weekly' || value === 'monthly' ? value : 'daily';
}

function getInitialChannel(): UpdateChannel {
  if (typeof window === 'undefined') return 'stable';
  const value = localStorage.getItem(CHANNEL_STORAGE_KEY);
  return value === 'dev' || value === 'staging' || value === 'beta' || value === 'stable'
    ? value
    : 'stable';
}

function errorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'string' && error.trim()) return error;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

function formatProgress(progress: UpdateDownloadProgress): string {
  return progress.totalBytes == null
    ? formatBytes(progress.downloadedBytes)
    : `${formatBytes(progress.downloadedBytes)} / ${formatBytes(progress.totalBytes)}`;
}

function storeSuccessfulCheckTime(): string {
  const now = new Date();
  try {
    localStorage.setItem(LAST_CHECK_STORAGE_KEY, String(now.getTime()));
  } catch {
    // The update workflow still works when browser storage is unavailable.
  }
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

interface UpdateStoreState {
  status: UpdateStatus;
  isModalOpen: boolean;
  updatePayload: LatestRelease | null;
  downloadedArtifactPath: string | null;
  downloadProgress: number | null;
  downloadSpeed: string;
  downloadedText: string;
  errorMessage: string | null;
  lastCheckedTime: string | null;
  updateCheckPolicy: UpdateCheckPolicy;
  updateCheckFrequency: UpdateCheckFrequency;
  updateChannel: UpdateChannel;

  setUpdateCheckPolicy: (policy: UpdateCheckPolicy) => void;
  setUpdateCheckFrequency: (frequency: UpdateCheckFrequency) => void;
  setUpdateChannel: (channel: UpdateChannel) => void;
  openModal: () => void;
  closeModal: () => void;
  checkForUpdates: (manualTrigger?: boolean) => Promise<void>;
  checkIfUpdateDueAndRun: () => Promise<void>;
  startDownload: () => Promise<void>;
  cancelDownload: () => Promise<void>;
  installDownloadedUpdate: () => Promise<void>;
  reset: () => void;
}

export const useUpdateStore = create<UpdateStoreState>((set, get) => ({
  status: 'idle',
  isModalOpen: false,
  updatePayload: null,
  downloadedArtifactPath: null,
  downloadProgress: null,
  downloadSpeed: '',
  downloadedText: '',
  errorMessage: null,
  lastCheckedTime: null,
  updateCheckPolicy: getInitialPolicy(),
  updateCheckFrequency: getInitialFrequency(),
  updateChannel: getInitialChannel(),

  setUpdateCheckPolicy: (policy) => {
    try {
      localStorage.setItem(POLICY_STORAGE_KEY, policy);
    } catch {
      // Keep the in-memory preference even if storage is unavailable.
    }
    set({ updateCheckPolicy: policy });
  },

  setUpdateCheckFrequency: (frequency) => {
    try {
      localStorage.setItem(FREQUENCY_STORAGE_KEY, frequency);
    } catch {
      // Keep the in-memory preference even if storage is unavailable.
    }
    set({ updateCheckFrequency: frequency });
  },

  setUpdateChannel: (channel) => {
    if (get().status === 'downloading' || get().status === 'cancelling') return;
    updateCheckGeneration += 1;
    try {
      localStorage.setItem(CHANNEL_STORAGE_KEY, channel);
    } catch {
      // Keep the in-memory preference even if storage is unavailable.
    }
    set({
      updateChannel: channel,
      status: 'idle',
      updatePayload: null,
      downloadedArtifactPath: null,
      errorMessage: null,
    });
  },

  openModal: () => {
    set({ isModalOpen: true });
    if (get().status === 'idle') void get().checkForUpdates(true);
  },

  closeModal: () => set({ isModalOpen: false }),

  checkForUpdates: async (manualTrigger = true) => {
    if (get().status === 'checking' || get().status === 'downloading' || get().status === 'cancelling') {
      return;
    }

    set({
      status: 'checking',
      errorMessage: null,
      downloadProgress: null,
      downloadSpeed: '',
      downloadedText: '',
      downloadedArtifactPath: null,
    });
    const requestGeneration = ++updateCheckGeneration;

    try {
      const release = await checkForUpdate(get().updateChannel);
      if (requestGeneration !== updateCheckGeneration) return;
      const lastCheckedTime = storeSuccessfulCheckTime();

      if (release?.hasUpdate) {
        set({ status: 'available', updatePayload: release, lastCheckedTime });
        if (!manualTrigger) {
          if (get().updateCheckPolicy === 'notify_only') {
            void notificationService.notify({
              title: 'Stage0 update available',
              body: `Stage0 ${release.version} is available on the ${release.channel} channel.`,
              level: 'update',
              channel: 'softwareUpdates',
              clickAction: { label: 'View update', actionType: 'open_preferences_updates' },
              dismissPolicy: 'both',
              autoDismissMs: 10000,
              actions: [{ label: 'View Update', actionType: 'open_preferences_updates' }],
            });
          } else if (get().updateCheckPolicy === 'auto_install') {
            void get().startDownload();
          }
        }
      } else {
        set({ status: 'up-to-date', updatePayload: null, lastCheckedTime });
      }
    } catch (error) {
      if (requestGeneration !== updateCheckGeneration) return;
      const message = errorMessage(error, 'Unable to check for Stage0 updates.');
      if (manualTrigger) {
        set({ status: 'error', errorMessage: message });
      } else {
        set({ status: 'idle', errorMessage: null });
      }
    }
  },

  checkIfUpdateDueAndRun: async () => {
    const { updateCheckPolicy, updateCheckFrequency, status } = get();
    if (updateCheckPolicy === 'disabled') return;
    if (status === 'checking' || status === 'downloading' || status === 'cancelling' || status === 'ready') return;

    const intervalMap: Record<UpdateCheckFrequency, number> = {
      daily: 24 * 60 * 60 * 1000,
      weekly: 7 * 24 * 60 * 60 * 1000,
      monthly: 30 * 24 * 60 * 60 * 1000,
    };
    let lastCheck = 0;
    try {
      lastCheck = Number(localStorage.getItem(LAST_CHECK_STORAGE_KEY) || 0);
    } catch {
      // No stored check timestamp means the first scheduled check is due.
    }
    if (!Number.isFinite(lastCheck)) lastCheck = 0;
    if (!lastCheck || Date.now() - lastCheck >= intervalMap[updateCheckFrequency]) {
      await get().checkForUpdates(false);
    }
  },

  startDownload: async () => {
    const release = get().updatePayload;
    if (!release || get().status === 'downloading' || get().status === 'cancelling') return;

    set({
      status: 'downloading',
      downloadProgress: 0,
      downloadSpeed: 'Starting…',
      downloadedText: release.sizeBytes == null ? '0 B' : `0 B / ${formatBytes(release.sizeBytes)}`,
      errorMessage: null,
      downloadedArtifactPath: null,
    });

    try {
      const artifactPath = await downloadUpdate(get().updateChannel, release.version, (progress) => {
        set({
          downloadProgress: progress.percent,
          downloadSpeed: progress.bytesPerSecond > 0
            ? `${formatBytes(progress.bytesPerSecond)}/s`
            : 'Receiving…',
          downloadedText: formatProgress(progress),
        });
      });
      set({
        status: 'ready',
        downloadedArtifactPath: artifactPath,
        downloadProgress: 100,
        downloadSpeed: 'Verified',
      });

      if (get().updateCheckPolicy === 'auto_install') {
        await get().installDownloadedUpdate();
      }
    } catch (error) {
      const message = errorMessage(error, 'The update download failed.');
      const cancelled = message.toLowerCase().includes('cancelled');
      set({
        status: cancelled ? 'available' : 'error',
        errorMessage: cancelled ? null : message,
        downloadProgress: 0,
        downloadSpeed: '',
        downloadedText: '',
      });
    }
  },

  cancelDownload: async () => {
    if (get().status !== 'downloading' && get().status !== 'cancelling') return;
    set({ status: 'cancelling' });
    try {
      await cancelUpdateDownload();
      set({
        status: 'available',
        downloadProgress: null,
        downloadSpeed: '',
        downloadedText: '',
      });
    } catch (error) {
      set({ status: 'error', errorMessage: errorMessage(error, 'Could not cancel the update download.') });
    }
  },

  installDownloadedUpdate: async () => {
    const artifactPath = get().downloadedArtifactPath;
    if (!artifactPath) {
      set({ status: 'error', errorMessage: 'There is no verified update package ready to install.' });
      return;
    }
    try {
      await installUpdate(artifactPath);
    } catch (error) {
      set({ status: 'error', errorMessage: errorMessage(error, 'Could not launch the operating-system installer.') });
    }
  },

  reset: () => {
    updateCheckGeneration += 1;
    if (get().status === 'downloading' || get().status === 'cancelling') {
      void cancelUpdateDownload();
    }
    set({
      status: 'idle',
      updatePayload: null,
      downloadedArtifactPath: null,
      downloadProgress: null,
      downloadSpeed: '',
      downloadedText: '',
      errorMessage: null,
    });
  },
}));
