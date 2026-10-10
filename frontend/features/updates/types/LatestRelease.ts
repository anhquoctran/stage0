import type { UpdateChannel } from './UpdateChannel';

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
