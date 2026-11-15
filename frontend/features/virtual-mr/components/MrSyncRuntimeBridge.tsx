import { useEffect } from 'react';
import { useApplicationServices } from '../../../core/services/runtime/useApplicationServices';
import { useGitStore } from '../../git/store/useGitStore';
import { useVirtualMrStore } from '../store/useVirtualMrStore';
import { installMrSyncRuntime } from '../services/mrSyncRuntime';

/** Attach UI subscriptions only after the repository workspace has hydrated. */
export function MrSyncRuntimeBridge() {
  const services = useApplicationServices();
  const repoId = useGitStore(state => state.currentRepo?.id);
  const ready = useVirtualMrStore(state => Boolean(repoId) && state.currentRepoId === repoId && !state.isLoadingSessions);
  useEffect(() => ready ? installMrSyncRuntime(services) : undefined, [services, ready]);
  return null;
}
