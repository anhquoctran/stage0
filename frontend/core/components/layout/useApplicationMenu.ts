import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useEffect, useMemo, useRef } from 'react';
import { isMacOS } from '../../../common/utils/shortcuts';
import { useGitStore } from '../../../features/git/store/useGitStore';
import { usePreferencesStore } from '../../../features/preferences/store/usePreferencesStore';
import { usePerformanceMonitorStore } from '../../../features/performance/store/usePerformanceMonitorStore';
import { getApplicationMenuFlags } from '../../services/applicationMenuState';
import { executeMenuAction } from '../../services/applicationMenuActions';
import { menuActionForShortcut } from '../../services/applicationMenuShortcuts';
import type { MenuCallbacks } from '../../types/menu/MenuCallbacks';

export function useApplicationMenu(callbacks: MenuCallbacks) {
  const git = useGitStore();
  const prefs = usePreferencesStore();
  const perf = usePerformanceMonitorStore();
  const callbackRef = useRef(callbacks);
  callbackRef.current = callbacks;
  const flags = useMemo(getApplicationMenuFlags, [
    git.currentRepo,
    git.selectedFile,
    git.isSyncing,
    git.isRebasing,
    git.recentRepos,
    git.viewMode,
    git.fileViewTab,
    git.fileListLayout,
    prefs.showInlineBlame,
    perf.isEnabled,
  ]);
  const mac = isMacOS();

  useEffect(() => {
    if (mac && isTauri()) {
      void invoke('update_application_menu_state', { flags }).catch((error) =>
        console.warn('[Stage0 menu] Could not sync native menu state:', error)
      );
    }
  }, [mac, flags]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    if (isTauri())
      void listen<string>('menu-action', (event) => {
        if (!disposed) void executeMenuAction(event.payload, callbackRef.current);
      })
        .then((stop) => {
          if (disposed) stop();
          else unlisten = stop;
        })
        .catch(() => {});
    const onKeyDown = (event: KeyboardEvent) => {
      // Native accelerators own macOS commands; never execute them a second time.
      if ((mac && isTauri()) || event.defaultPrevented || event.isComposing || event.repeat) return;
      const id = menuActionForShortcut(event, mac);
      if (!id) return;
      event.preventDefault();
      void executeMenuAction(id, callbackRef.current);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      disposed = true;
      unlisten?.();
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [mac]);
  return { flags, recentRepos: git.recentRepos };
}
