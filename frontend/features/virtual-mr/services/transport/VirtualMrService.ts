import type { VirtualMrSessionRecord } from '../../types/VirtualMrSessionRecord';
import type { VirtualMrSessionSaveOutcome } from '../../types/VirtualMrSessionSaveOutcome';

export interface VirtualMrService {
  listVirtualMrSessions(input: { repoId: string }): Promise<VirtualMrSessionRecord[]>;
  saveVirtualMrSession(input: { session: VirtualMrSessionRecord }): Promise<VirtualMrSessionSaveOutcome>;
}
