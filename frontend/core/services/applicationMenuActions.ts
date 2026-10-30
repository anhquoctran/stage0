import { getApplicationServices } from './runtime/applicationRuntime';

import { useGitStore } from '../../features/git/store/useGitStore';
import { useVirtualMrStore } from '../../features/virtual-mr/store/useVirtualMrStore';
import { usePreferencesStore } from '../../features/preferences/store/usePreferencesStore';
import { usePerformanceMonitorStore } from '../../features/performance/store/usePerformanceMonitorStore';
import { useOnboardingStore } from '../../features/onboarding/store/useOnboardingStore';
import { useThemeStore } from '../store/useThemeStore';
import { MENU_COMMANDS, menuEnabled, type MenuActionId } from '../constants/applicationMenu';
import type { MenuCallbacks } from '../types/menu/MenuCallbacks';
import { getApplicationMenuFlags } from './applicationMenuState';
import { runMenuFileAction } from './applicationMenuFileActions';
import { runMenuTextEditing } from './applicationMenuTextEditing';

// Both native events and custom menu clicks enter here and recheck current state.
export async function executeMenuAction(id: string, callbacks: MenuCallbacks): Promise<void> {
  if (useOnboardingStore.getState().isOnboardingOpen) return;
  const git = useGitStore.getState();
  if (id.startsWith('remove_recent_repo_')) {
    const repo = git.recentRepos.find((item) => item.id === id.slice('remove_recent_repo_'.length));
    if (repo) await git.removeRecentRepo(repo.id);
    return;
  }
  if (id.startsWith('recent_repo_')) {
    const repo = git.recentRepos.find((item) => item.id === id.slice('recent_repo_'.length));
    if (repo) await git.selectRepo(repo);
    return;
  }
  const command = MENU_COMMANDS[id];
  if (
    !Object.hasOwn(MENU_COMMANDS, id) ||
    !command ||
    !menuEnabled(command.requires, getApplicationMenuFlags())
  )
    return;
  const prefs = usePreferencesStore.getState();
  const mr = useVirtualMrStore.getState();
  const nativeOnly = () => {}; // These roles are handled by the native OS menu.
  const actions: Record<MenuActionId, () => unknown> = {
    new_window: () => getApplicationServices().application.createNewWindow(),
    open_repo: () => git.openRepoDialog(),
    open_repo_new_window: () => git.openRepoDialog(true),
    clone_repo: () => git.setIsCloneModalOpen(true),
    close_repo: () => git.closeRepo(),
    close_window: () => getApplicationServices().application.windowClose(),
    exit: () => getApplicationServices().application.windowClose(),
    clear_recent: () => git.clearRecentRepos(),
    preferences: () => prefs.setIsPreferencesOpen(true),
    undo: () => runMenuTextEditing('undo'),
    redo: () => runMenuTextEditing('redo'),
    cut: () => runMenuTextEditing('cut'),
    copy: () => runMenuTextEditing('copy'),
    paste: () => runMenuTextEditing('paste'),
    select_all: () => runMenuTextEditing('selectAll'),
    view_blame: () => {
      if (!git.selectedFile) return;
      git.setFileViewTab('blame');
      return git.fetchFileBlame(git.selectedFile.path);
    },
    reveal_file: () => runMenuFileAction(id),
    copy_rel_path: () => runMenuFileAction(id),
    copy_abs_path: () => runMenuFileAction(id),
    copy_remote_url: () => runMenuFileAction(id),
    copy_remote_url_from: () => runMenuFileAction(id),
    previous_file: () => git.selectPrevFile(),
    next_file: () => git.selectNextFile(),
    view_split: () => git.setViewMode('split'),
    view_unified: () => git.setViewMode('unified'),
    toggle_blame: () => git.toggleFileBlame(),
    toggle_inline_blame: () => prefs.toggleInlineBlame(),
    view_git_graph: () => git.setIsGitGraphOpen(true),
    file_list_flat: () => git.setFileListLayout('flat'),
    file_list_tree: () => git.setFileListLayout('tree'),
    toggle_theme: () => useThemeStore.getState().toggleTheme(),
    toggle_perf_monitor: () => usePerformanceMonitorStore.getState().toggle(),
    repo_overview: () => git.setIsRepoOverviewOpen(true),
    new_mr: () => mr.openNewMrDraft(),
    fetch: () => git.runSync('fetch'),
    pull: () => git.runSync('pull'),
    pull_from: () => git.setIsPullFromOpen(true),
    merge: () => git.runSync('merge'),
    merge_from: () => git.setIsMergeFromOpen(true),
    rebase: () => git.runSync('rebase'),
    rebase_from: () => git.setIsRebaseFromOpen(true),
    rebase_continue: () => git.runSync('rebase_continue'),
    rebase_skip: () => git.runSync('rebase_skip'),
    rebase_abort: () => git.runSync('rebase_abort'),
    swap_branches: () => git.swapBranches(),
    refresh_diff: () => git.refreshDiff(),
    open_terminal: () => runMenuFileAction(id),
    open_vscode: () => runMenuFileAction(id),
    open_explorer: () => runMenuFileAction(id),
    repo_settings: () => mr.openRepoSettings('remotes'),
    shortcuts: callbacks.onOpenShortcuts,
    keymaps: () => prefs.openPreferences('general-keymaps'),
    release_notes: callbacks.onOpenReleaseNotes,
    about: callbacks.onOpenAbout,
    open_webview_devtools: () => getApplicationServices().application.openWebviewDevtools(),
    zoom: () => getApplicationServices().application.windowToggleMaximize(),
    minimize: () => getApplicationServices().application.windowMinimize(),
    services: nativeOnly,
    hide: nativeOnly,
    hide_others: nativeOnly,
    show_all: nativeOnly,
    quit: nativeOnly,
    fullscreen: nativeOnly,
    bring_all_to_front: nativeOnly,
  };
  try {
    await actions[id as MenuActionId]();
  } catch (error) {
    git.showToast(
      i18n.t('menu.toasts.actionFailed', { error: error instanceof Error ? error.message : String(error) }),
      'error'
    );
  }
}
import i18n from '../../features/i18n/i18n';
