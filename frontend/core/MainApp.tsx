import React, { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { invoke, isTauri } from '../common/services/ipc/ipcClient';
import { listen } from '../common/services/ipc/ipcEvents';
import { MainLayout } from './components/layout/MainLayout';
import { notificationService } from '../features/notifications/services/notificationService';
import { syncUnreadBadge } from '../features/notifications/services/notificationBadgeService';
import { useGitStore } from '../features/git/store/useGitStore';
import { useNotificationStore } from '../features/notifications/store/useNotificationStore';
import { type RepoInfo } from '../features/git/types/RepoInfo';
import { type WindowStartupContext } from '../features/git/types/WindowStartupContext';
import { FirstLaunchWelcome } from '../features/onboarding/components/FirstLaunchWelcome';
import { useOnboardingStore } from '../features/onboarding/store/useOnboardingStore';
import { reviewAssignedSessionAfterGitChange } from '../features/review/services/assignedReviewService';
import { installAutoHideScrollbars } from './services/autoHideScrollbars';

export const MainApp: React.FC = () => {
  const { initApp, attachRepoToCurrentWindow, refreshDiff, isInitializing } = useGitStore();
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const isOnboardingOpen = useOnboardingStore((state) => state.isOnboardingOpen);
  const setOnboardingOpen = useOnboardingStore((state) => state.setOnboardingOpen);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const usesNativeMacFrame =
    isTauri() &&
    typeof navigator !== 'undefined' &&
    /Mac/i.test(navigator.platform || navigator.userAgent);
  const hideCustomFrame = isFullscreen || (isMaximized && !usesNativeMacFrame);

  useEffect(() => installAutoHideScrollbars(), []);

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

    const initializeWindow = async () => {
      try {
        const [stopFsListener, stopOpenListener] = await Promise.all([
          listen<{ repo_path: string }>('repo-fs-changed', (event) => {
            const activePath = useGitStore.getState().currentRepo?.local_path;
            if (activePath === event.payload.repo_path) {
              refreshDiff();
              void reviewAssignedSessionAfterGitChange(event.payload.repo_path);
            }
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
    void notificationService.init();

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
      window.removeEventListener('resize', checkWindowState);
    };
  }, [initApp, attachRepoToCurrentWindow, refreshDiff]);

  useEffect(() => {
    void syncUnreadBadge(unreadCount);
  }, [unreadCount]);

  return (
    <div
      className={clsx(
        'flex flex-col h-screen w-screen overflow-hidden box-border bg-crust select-none transition-all duration-150',
        hideCustomFrame ? 'border-0' : 'border border-surface0'
      )}
    >
      <MainLayout />
      {!isInitializing && isOnboardingOpen && (
        <FirstLaunchWelcome onComplete={() => setOnboardingOpen(false)} />
      )}
    </div>
  );
};
