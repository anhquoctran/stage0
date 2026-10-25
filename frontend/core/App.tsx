import { useApplicationServices } from './services/runtime/useApplicationServices';
import React from 'react';

import { NotificationHost } from '../features/notifications/components/NotificationHost';

import { MainApp } from './MainApp';

export const App: React.FC = () => {
  const appServices = useApplicationServices();
  if (appServices.platform.capabilities.windows && appServices.platform.windows.current().label === 'notification-host') {
    return <NotificationHost />;
  }
  return <MainApp />;
};

export default App;
