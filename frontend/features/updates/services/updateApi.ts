import { Channel, invoke, isTauri } from '@tauri-apps/api/core';
import { type LatestRelease } from '../types/LatestRelease';
import { type UpdateChannel } from '../types/UpdateChannel';
import { type UpdateDownloadProgress } from '../types/UpdateDownloadProgress';

function requireDesktopRuntime(): void {
  if (!isTauri()) {
    throw new Error('Software updates are available only in the Stage0 desktop application.');
  }
}

export async function checkForUpdate(
  channel: UpdateChannel,
): Promise<LatestRelease | null> {
  requireDesktopRuntime();
  return invoke<LatestRelease | null>('check_for_update', {
    channel,
  });
}

export async function downloadUpdate(
  channel: UpdateChannel,
  expectedVersion: string,
  onProgress: (progress: UpdateDownloadProgress) => void,
): Promise<string> {
  requireDesktopRuntime();
  const progressChannel = new Channel<UpdateDownloadProgress>(onProgress);
  return invoke<string>('download_update', {
    channel,
    expectedVersion,
    onProgress: progressChannel,
  });
}

export async function cancelUpdateDownload(): Promise<void> {
  requireDesktopRuntime();
  await invoke('cancel_update_download');
}

export async function installUpdate(artifactPath: string): Promise<void> {
  requireDesktopRuntime();
  await invoke('install_update', { artifactPath });
}
