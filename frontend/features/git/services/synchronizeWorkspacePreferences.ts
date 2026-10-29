import type { PreferenceBootstrap } from '../../preferences/types/PreferenceBootstrap';
import { useGitStore } from '../store/useGitStore';
import { useGitBinaryStore } from '../store/useGitBinaryStore';

/** Apply shared app settings without replacing any repository/session state. */
export function synchronizeWorkspacePreferences(settings: PreferenceBootstrap) {
  const sandbox = settings.sandbox?.type ?? 'in_memory';
  if (sandbox === 'in_memory' || sandbox === 'docker' || sandbox === 'local_worktree') {
    const changed = useGitStore.getState().activeSandboxType !== sandbox;
    useGitStore.setState({ activeSandboxType: sandbox });
    if (changed && useGitStore.getState().currentRepo) void useGitStore.getState().refreshDiff();
  }
  const id = settings.git?.binaryId ?? 'system-default';
  const path = settings.git?.binaryPath ?? 'git';
  if (typeof id === 'string' && typeof path === 'string') {
    useGitBinaryStore.setState(state => ({ activeBinaryId: id, activeBinaryPath: path,
      binaries: state.binaries.map(binary => ({ ...binary, is_active: binary.id === id })),
    }));
  }
}
