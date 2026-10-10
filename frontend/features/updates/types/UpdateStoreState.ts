import { type LatestRelease } from './LatestRelease';
import { type UpdateChannel } from './UpdateChannel';
import { type UpdateCheckFrequency } from './UpdateCheckFrequency';
import { type UpdateCheckPolicy } from './UpdateCheckPolicy';
import { type UpdateStatus } from './UpdateStatus';

export interface UpdateStoreState {
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
