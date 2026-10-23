import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useEffect } from 'react';
import { useGitStore } from '../../../features/git/store/useGitStore';
import type { NativeMenuActionsContext } from './NativeMenuActionsContext';

export function useNativeMenuActions({
  openRepoDialog,
  setIsCloneModalOpen,
  closeRepo,
  setIsPreferencesOpen,
  openNewMrDraft,
  runSync,
  setIsPullFromOpen,
  setIsMergeFromOpen,
  setIsRebaseFromOpen,
  setIsGitGraphOpen,
  openRepoSettings,
  setViewMode,
  toggleFileBlame,
  toggleInlineBlame,
  togglePerformanceMonitor,
  setShowShortcutsModal,
  setShowAboutModal,
}: NativeMenuActionsContext) {
  useEffect(() => {
    let isDisposed = false;
    let unlistenFn: (() => void) | undefined;

    listen<string>('menu-action', (event) => {
      if (isDisposed) return;

      if (event.payload.startsWith('recent_repo_')) {
        const repositoryId = event.payload.slice('recent_repo_'.length);
        const repository = useGitStore
          .getState()
          .recentRepos.find((repo) => repo.id === repositoryId);
        if (repository) {
          void useGitStore.getState().selectRepo(repository);
        }
        return;
      }

      switch (event.payload) {
        case 'open_repo':
          openRepoDialog();
          break;
        case 'open_repo_new_window':
          openRepoDialog(true);
          break;
        case 'new_window':
          void invoke('create_new_window');
          break;
        case 'close_window':
          void invoke('window_close');
          break;
        case 'clone_repo':
          setIsCloneModalOpen(true);
          break;
        case 'close_repo':
          closeRepo();
          break;
        case 'preferences':
          setIsPreferencesOpen(true);
          break;
        case 'new_mr':
          openNewMrDraft();
          break;
        case 'fetch':
          runSync('fetch');
          break;
        case 'pull':
          runSync('pull');
          break;
        case 'pull_from':
          setIsPullFromOpen(true);
          break;
        case 'merge':
          runSync('merge');
          break;
        case 'merge_from':
          setIsMergeFromOpen(true);
          break;
        case 'rebase':
          runSync('rebase');
          break;
        case 'rebase_from':
          setIsRebaseFromOpen(true);
          break;
        case 'view_git_graph':
          setIsGitGraphOpen(true);
          break;
        case 'repo_settings':
          openRepoSettings('remotes');
          break;
        case 'view_split':
          setViewMode('split');
          break;
        case 'view_unified':
          setViewMode('unified');
          break;
        case 'toggle_blame':
          toggleFileBlame();
          break;
        case 'toggle_inline_blame':
          toggleInlineBlame();
          break;
        case 'toggle_perf_monitor':
          togglePerformanceMonitor();
          break;
        case 'shortcuts':
          setShowShortcutsModal(true);
          break;
        case 'open_webview_devtools':
          void invoke('open_webview_devtools');
          break;
        case 'about':
          setShowAboutModal(true);
          break;
        default:
          break;
      }
    })
      .then((unlisten) => {
        if (isDisposed) {
          unlisten();
        } else {
          unlistenFn = unlisten;
        }
      })
      .catch(() => {});

    return () => {
      isDisposed = true;
      if (unlistenFn) unlistenFn();
    };
  }, [
    openRepoDialog,
    setIsCloneModalOpen,
    closeRepo,
    setIsPreferencesOpen,
    openNewMrDraft,
    runSync,
    openRepoSettings,
    setViewMode,
    setIsPullFromOpen,
    setIsMergeFromOpen,
    setIsRebaseFromOpen,
    setIsGitGraphOpen,
    toggleFileBlame,
    toggleInlineBlame,
    togglePerformanceMonitor,
  ]);

  return {};
}
