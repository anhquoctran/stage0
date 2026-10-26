import type { SoftwareUpdateStatus } from './SoftwareUpdateStatus';

export interface SoftwareUpdateState {
  status: SoftwareUpdateStatus | null;
  panelOpen: boolean;
  pending: boolean;
  error: string | null;
  connect(): () => void;
  openPanel(): void;
  closePanel(): void;
  check(): Promise<void>;
  download(): Promise<void>;
  install(savedWorkConfirmed: boolean): Promise<void>;
}
