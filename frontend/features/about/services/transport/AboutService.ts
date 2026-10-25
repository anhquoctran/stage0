import type { SoftwareAboutInfo } from '../../types/SoftwareAboutInfo';

/** Feature-owned backend contract. Inputs retain the existing wire field names. */
export interface AboutService {
  getAppInfo(): Promise<SoftwareAboutInfo>;
  getReleaseNotes(): Promise<string>;
}
