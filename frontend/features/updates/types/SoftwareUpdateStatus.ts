export interface SoftwareUpdateStatus {
  revision: number;
  phase: 'idle' | 'unavailable' | 'checking' | 'current' | 'available' | 'downloading' | 'ready' | 'installing' | 'error';
  currentVersion: string;
  version: string | null;
  notes: string | null;
  downloadedBytes: number;
  totalBytes: number | null;
  checkedAt: string | null;
  message: string | null;
  supported: boolean;
}
