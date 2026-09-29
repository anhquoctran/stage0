import React, { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { MainLayout } from './components/layout/MainLayout';
import { SplashScreen } from './components/layout/SplashScreen';
import { useGitStore } from './store/useGitStore';

export const App: React.FC = () => {
  const { initApp, refreshDiff, isInitializing } = useGitStore();

  useEffect(() => {
    initApp();

    const unlistenPromise = listen<{ repo_path: string }>(
      'repo-fs-changed',
      (event) => {
        console.log('Realtime file system event received:', event.payload.repo_path);
        refreshDiff();
      }
    );

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [initApp, refreshDiff]);

  return (
    <>
      <SplashScreen isInitializing={isInitializing} />
      <MainLayout />
    </>
  );
};

export default App;
