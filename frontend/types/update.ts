/**
 * Software Update Types & Contract Definitions
 * 100% English - Stage0 Auto-Update Architecture
 */

export interface UpdateCheckParams {
  current_version: string;
  os_name: string;
  arch_name: string;
}

export type UpdateResponseCode =
  | 'UPDATE_AVAILABLE'
  | 'UP_TO_DATE'
  | 'PLATFORM_NOT_SUPPORTED'
  | 'CHECK_ERROR';

export interface UpdatePayload {
  latestVersion: string;
  packageVersion: string;
  releaseDate: string;
  downloadUrl: string;
  sha256?: string;
  fileSize?: string;
  releaseNotes?: string;
  mandatory?: boolean;
}

export interface UpdateCheckResponse {
  code: UpdateResponseCode;
  message: string;
  data?: UpdatePayload | null;
}

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'error';

export type MockScenario = 'available' | 'up_to_date' | 'error';

export type UpdateCheckPolicy =
  | 'disabled'
  | 'notify_only'
  | 'auto_install';

export type UpdateCheckFrequency =
  | 'daily'
  | 'weekly'
  | 'monthly';
