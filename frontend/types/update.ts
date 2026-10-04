export type UpdateChannel = 'dev' | 'staging' | 'beta' | 'stable';

export interface LatestRelease {
  version: string;
  codename: string | null;
  changelog: string | null;
  platform: string;
  arch: string;
  channel: UpdateChannel;
  fileName: string;
  sizeBytes: number | null;
  checksum: string | null;
  hasUpdate: boolean;
}

export interface UpdateDownloadProgress {
  downloadedBytes: number;
  totalBytes: number | null;
  percent: number | null;
  bytesPerSecond: number;
}

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'available'
  | 'downloading'
  | 'cancelling'
  | 'ready'
  | 'error';

export type UpdateCheckPolicy = 'disabled' | 'notify_only' | 'auto_install';

export type UpdateCheckFrequency = 'daily' | 'weekly' | 'monthly';
