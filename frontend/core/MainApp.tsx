import { useDesktopWindowChrome } from './hooks/useDesktopWindowChrome';
import { useWindowChromeStore } from './store/useWindowChromeStore';
import { useStartupSplash } from './hooks/useStartupSplash';
import { startupProgress } from './services/startup/startupProgress';
import type { WindowStartupContext } from '../features/git/types/WindowStartupContext';
import { useVirtualMrStore } from '../features/virtual-mr/store/useVirtualMrStore';
import { useApplicationServices } from './services/runtime/useApplicationServices';
import React, { useEffect, useState } from 'react';
import { clsx } from 'clsx';

import { MainLayout } from './components/layout/MainLayout';
import { notificationService } from '../features/notifications/services/notificationService';
import { syncUnreadBadge } from '../features/notifications/services/notificationBadgeService';
import { useGitStore } from '../features/git/store/useGitStore';
import { useNotificationStore } from '../features/notifications/store/useNotificationStore';
import { type RepoInfo } from '../features/git/types/RepoInfo';
import { FirstLaunchWelcome } from '../features/onboarding/components/FirstLaunchWelcome';
import { useOnboardingStore } from '../features/onboarding/store/useOnboardingStore';
import { reviewAssignedSessionAfterGitChange } from '../features/review/services/assignedReviewService';
import { installAutoHideScrollbars } from './services/autoHideScrollbars';
import { SoftwareUpdateNotice } from '../features/updates/components/SoftwareUpdateNotice';

export const MainApp: React.FC = () => {
  const appServices = useApplicationServices();
  const chromeReady = useDesktopWindowChrome();
  const nativeFrame = useWindowChromeStore((state) => state.profile.nativeFrame);
  const { initApp, attachRepoToCurrentWindow, refreshDiff, isInitializing, isLoading, currentRepo } = useGitStore();
  const [windowInitialized, setWindowInitialized] = useState(false);
  const workspaceReady = useVirtualMrStore((state) => !currentRepo || (
    state.currentRepoId === currentRepo.id && state.currentRepoPath === currentRepo.local_path && !state.isLoadingSessions
  ));
  useStartupSplash(chromeReady && windowInitialized && !isInitializing && !isLoading && workspaceReady);
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const isOnboardingOpen = useOnboardingStore((state) => state.isOnboardingOpen);
  const setOnboardingOpen = useOnboardingStore((state) => state.setOnboardingOpen);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const usesNativeMacFrame =
    appServices.platform.capabilities.windows &&
    typeof navigator !== 'undefined' &&
    /Mac/i.test(navigator.platform || navigator.userAgent);
  const hideCustomFrame = nativeFrame || isFullscreen || (isMaximized && !usesNativeMacFrame);

  useEffect(() => installAutoHideScrollbars(), []);

  useEffect(() => {
    let disposed = false;
    let listenerFailed = false;
    const subscriptions = new Set<() => void>();
    const register = (pending: Promise<() => void>) => pending.then((stop) => {
      if (disposed || listenerFailed) stop();
      else subscriptions.add(stop);
    });
    const stopSubscriptions = () => {
      subscriptions.forEach((stop) => stop());
      subscriptions.clear();
    };

    const initializeWindow = async () => {
      startupProgress.begin('window');
      let startup: WindowStartupContext | undefined;
      try {
        if (appServices.platform.capabilities.events) {
          await Promise.all([
            register(appServices.platform.events.subscribe<{ repo_path: string }>('repo-fs-changed', (event) => {
              const activePath = useGitStore.getState().currentRepo?.local_path;
              if (activePath === event.repo_path) {
                refreshDiff();
                void reviewAssignedSessionAfterGitChange(event.repo_path);
              }
            })),
            register(appServices.platform.events.subscribe<RepoInfo>('repo-open-request', (event) => {
              void attachRepoToCurrentWindow(event);
            })),
          ]);
        }
        if (disposed) return;
        if (appServices.platform.capabilities.backend) {
          startup = await appServices.application.getWindowStartupContext();
        }
      } catch (error) {
        listenerFailed = true;
        stopSubscriptions();
        console.warn('Failed to initialize window context:', error);
      }
      if (disposed) return;
      startupProgress.complete('window');
      startupProgress.begin('repositories');
      await initApp(startup?.restore_recent ?? true, (progress) => {
        if (disposed) return;
        if (progress.phase === 'catalog') {
          startupProgress.update('repositories', progress.completed / progress.total);
          if (progress.completed === progress.total) startupProgress.begin('workspace');
        } else {
          startupProgress.begin('workspace');
        }
      });
      if (disposed) return;
      startupProgress.complete('repositories');
      startupProgress.begin('workspace');
      if (startup?.repo) await attachRepoToCurrentWindow(startup.repo);
      if (disposed) return;
      // Remaining workspace work is observed through the MR store readiness key.
      startupProgress.update('workspace', 0.5);
      setWindowInitialized(true);
    };

    void initializeWindow().catch((error) => {
      if (disposed) return;
      startupProgress.fail();
      console.error('Could not prepare the startup workspace:', error);
    });
    void notificationService.init();

    const checkWindowState = async () => {
      try {
        const [maximized, fullscreen] = await Promise.all([
          appServices.application.windowIsMaximized(),
          appServices.application.windowIsFullscreen(),
        ]);
        setIsMaximized(maximized);
        setIsFullscreen(fullscreen);
      } catch {}
    };

    checkWindowState();
    window.addEventListener('resize', checkWindowState);

    return () => {
      disposed = true;
      stopSubscriptions();
      notificationService.destroy();
      window.removeEventListener('resize', checkWindowState);
    };
  }, [appServices, initApp, attachRepoToCurrentWindow, refreshDiff]);

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
      <SoftwareUpdateNotice />
      {!isInitializing && isOnboardingOpen && (
        <FirstLaunchWelcome onComplete={() => setOnboardingOpen(false)} />
      )}
    </div>
  );
};
