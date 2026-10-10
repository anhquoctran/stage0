import React from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { NotificationHost } from '../features/notifications/components/NotificationHost';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { MainApp } from './MainApp';

export const App: React.FC = () => {
  if (isTauri() && getCurrentWindow().label === 'notification-host') {
    return <NotificationHost />;
  }
  return <MainApp />;
};

export default App;
