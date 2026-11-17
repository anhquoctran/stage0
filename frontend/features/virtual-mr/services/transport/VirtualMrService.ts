import type { VirtualMrSessionRecord } from '../../types/VirtualMrSessionRecord';
import type { VirtualMrSessionSaveOutcome } from '../../types/VirtualMrSessionSaveOutcome';
import type { MrSyncState } from '../../types/MrSyncState';

export interface VirtualMrService {
  listVirtualMrSessions(input: { repoId: string }): Promise<VirtualMrSessionRecord[]>;
  saveVirtualMrSession(input: { session: VirtualMrSessionRecord }): Promise<VirtualMrSessionSaveOutcome>;
  readMrSync(input: { repoId: string; syncOnly: true; requestSync?: boolean }): Promise<MrSyncState[]>;
}
