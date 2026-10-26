import type { SoftwareUpdateStatus } from '../../types/SoftwareUpdateStatus';

export interface SoftwareUpdateService {
  getStatus(): Promise<SoftwareUpdateStatus>;
  check(): Promise<SoftwareUpdateStatus>;
  download(): Promise<void>;
  install(input: { savedWorkConfirmed: boolean }): Promise<void>;
}
