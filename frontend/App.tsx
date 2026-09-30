import React, { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { MainLayout } from './components/layout/MainLayout';
import { SplashScreen } from './components/layout/SplashScreen';
import { useGitStore } from './store/useGitStore';

export const App: React.FC = () => {
  const { initApp, refreshDiff, isInitializing } = useGitStore();
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    initApp();

    const unlistenPromise = listen<{ repo_path: string }>(
      'repo-fs-changed',
      (event) => {
        console.log('Realtime file system event received:', event.payload.repo_path);
        refreshDiff();
      }
    );

    const checkMaximized = async () => {
      try {
        const max = await invoke<boolean>('window_is_maximized');
        setIsMaximized(max);
      } catch {}
    };

    checkMaximized();
    window.addEventListener('resize', checkMaximized);

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
      window.removeEventListener('resize', checkMaximized);
    };
  }, [initApp, refreshDiff]);

  return (
    <div
      className={clsx(
        'flex flex-col h-screen w-screen overflow-hidden box-border bg-crust select-none transition-all duration-150',
        isMaximized
          ? 'border-0 rounded-none'
          : 'border border-primary rounded-[8px]'
      )}
    >
      <SplashScreen isInitializing={isInitializing} />
      <MainLayout />
    </div>
  );
};

export default App;
