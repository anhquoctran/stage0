import { useGitStore } from '../../features/git/store/useGitStore';
import { usePreferencesStore } from '../../features/preferences/store/usePreferencesStore';
import { usePerformanceMonitorStore } from '../../features/performance/store/usePerformanceMonitorStore';
import type { MenuFlags } from '../types/menu/MenuFlags';

export function getApplicationMenuFlags(): MenuFlags {
  const git = useGitStore.getState();
  const repository = Boolean(git.currentRepo);
  const file = repository && Boolean(git.selectedFile);
  return {
    repository,
    file,
    textFile: file && !git.selectedFile?.is_binary,
    idle: !git.isSyncing,
    rebasing: git.isRebasing,
    recents: git.recentRepos.length > 0,
    split: git.viewMode === 'split',
    unified: git.viewMode === 'unified',
    blame: git.fileViewTab === 'blame',
    flat: git.fileListLayout === 'flat',
    tree: git.fileListLayout === 'tree',
    inlineBlame: usePreferencesStore.getState().showInlineBlame,
    performance: usePerformanceMonitorStore.getState().isEnabled,
  };
}
