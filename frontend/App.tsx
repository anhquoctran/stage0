import React, { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { MainLayout } from './components/layout/MainLayout';
import { ToastContainer } from './components/common/ToastContainer';
import { notificationService } from './services/notificationService';
import { useGitStore } from './store/useGitStore';
import { useUpdateStore } from './store/useUpdateStore';
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
    if (isInitializing) return;

    const splash = document.getElementById('startup-splash');
    if (!splash) return;

    let removeTimer: number | undefined;
    const fadeTimer = window.setTimeout(() => {
      splash.classList.add('is-hidden');
      removeTimer = window.setTimeout(() => splash.remove(), 350);
    }, 500);

    return () => {
      window.clearTimeout(fadeTimer);
      if (removeTimer !== undefined) window.clearTimeout(removeTimer);
    };
  }, [isInitializing]);

  useEffect(() => {
    let disposed = false;
    let unlistenFs: (() => void) | undefined;
    let unlistenOpen: (() => void) | undefined;
    let startupCheckTimer: number | undefined;

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
      } finally {
        if (!disposed) {
          // Graceful startup delay (5s) per industry standard to avoid boot I/O & CPU contention
          startupCheckTimer = window.setTimeout(() => {
            if (!disposed) {
              void useUpdateStore.getState().checkIfUpdateDueAndRun();
            }
          }, 5000);
        }
      }
    };

    void initializeWindow();
    void notificationService.init();

    // Periodically evaluate update frequency during long-running app sessions (every 1 hour)
    const updateCheckInterval = window.setInterval(() => {
      if (!disposed) {
        void useUpdateStore.getState().checkIfUpdateDueAndRun();
      }
    }, 60 * 60 * 1000);

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
      notificationService.destroy();
      if (startupCheckTimer !== undefined) window.clearTimeout(startupCheckTimer);
      window.clearInterval(updateCheckInterval);
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
            ? 'border border-[#313244] rounded-[12px]'
            : 'border border-[#313244] rounded-[8px]'
      )}
    >
      <MainLayout />
      <ToastContainer />
    </div>
  );
};

export default App;
