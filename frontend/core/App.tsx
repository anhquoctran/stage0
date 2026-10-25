import React from 'react';
import { isTauri } from '../common/services/ipc/ipcClient';
import { NotificationHost } from '../features/notifications/components/NotificationHost';
import { getCurrentWindow } from '../common/services/ipc/ipcWindow';
import { MainApp } from './MainApp';

export const App: React.FC = () => {
  if (isTauri() && getCurrentWindow().label === 'notification-host') {
    return <NotificationHost />;
  }
  return <MainApp />;
};

export default App;
