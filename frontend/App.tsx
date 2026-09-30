import React, { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { MainLayout } from './components/layout/MainLayout';
import { SplashScreen } from './components/layout/SplashScreen';
import { useGitStore } from './store/useGitStore';
import type { RepoInfo, WindowStartupContext } from './types/git';

export const App: React.FC = () => {
  const { initApp, attachRepoToCurrentWindow, refreshDiff, isInitializing } = useGitStore();
  const [isMaximized, setIsMaximized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const usesNativeMacFrame =
    isTauri() &&
    typeof navigator !== 'undefined' &&
    /Mac/i.test(navigator.platform || navigator.userAgent);
  const hideCustomFrame = isFullscreen || (isMaximized && !usesNativeMacFrame);

  useEffect(() => {
    let disposed = false;
    let unlistenFs: (() => void) | undefined;
    let unlistenOpen: (() => void) | undefined;
    const preventWebViewContextMenu = (event: MouseEvent) => {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest('input, textarea, [contenteditable="true"]')
      ) {
        return;
      }
      event.preventDefault();
    };

    if (isTauri()) {
      // Keep native text-editing menus, but hide WebView's Reload/Inspect menu.
      document.addEventListener('contextmenu', preventWebViewContextMenu);
    }

    const initializeWindow = async () => {
      try {
        const [stopFsListener, stopOpenListener] = await Promise.all([
          listen<{ repo_path: string }>('repo-fs-changed', (event) => {
            const activePath = useGitStore.getState().currentRepo?.local_path;
            if (activePath === event.payload.repo_path) refreshDiff();
          }),
          listen<RepoInfo>('repo-open-request', (event) => {
            void attachRepoToCurrentWindow(event.payload);
          }),
        ]);

        if (disposed) {
          stopFsListener();
          stopOpenListener();
          return;
        }
        unlistenFs = stopFsListener;
        unlistenOpen = stopOpenListener;

        const startup = await invoke<WindowStartupContext>('get_window_startup_context');
        await initApp(startup.restore_recent);
        if (!disposed && startup.repo) {
          await attachRepoToCurrentWindow(startup.repo);
        }
      } catch (error) {
        console.warn('Failed to initialize window context:', error);
        await initApp();
      }
    };

    void initializeWindow();

    const checkWindowState = async () => {
      try {
        const [maximized, fullscreen] = await Promise.all([
          invoke<boolean>('window_is_maximized'),
          invoke<boolean>('window_is_fullscreen'),
        ]);
        setIsMaximized(maximized);
        setIsFullscreen(fullscreen);
      } catch {}
    };

    checkWindowState();
    window.addEventListener('resize', checkWindowState);

    return () => {
      disposed = true;
      unlistenFs?.();
      unlistenOpen?.();
      document.removeEventListener('contextmenu', preventWebViewContextMenu);
      window.removeEventListener('resize', checkWindowState);
    };
  }, [initApp, attachRepoToCurrentWindow, refreshDiff]);

  return (
    <div
      className={clsx(
        'flex flex-col h-screen w-screen overflow-hidden box-border bg-crust select-none transition-all duration-150',
        hideCustomFrame
          ? 'border-0 rounded-none'
          : usesNativeMacFrame
            ? 'border border-primary rounded-[12px]'
            : 'border border-primary rounded-[8px]'
      )}
    >
      <SplashScreen isInitializing={isInitializing} />
      <MainLayout />
    </div>
  );
};

export default App;
