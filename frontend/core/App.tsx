import { useApplicationServices } from './services/runtime/useApplicationServices';
import React from 'react';

import { MainApp } from './MainApp';
import { PreferencesWindow } from '../features/preferences/components/PreferencesWindow';
import { PREFERENCES_WINDOW_LABEL } from '../features/preferences/services/preferencesWindowService';

export const App: React.FC = () => {
  const appServices = useApplicationServices();
  if (appServices.platform.capabilities.windows && appServices.platform.windows.current().label === PREFERENCES_WINDOW_LABEL) {
    return <PreferencesWindow />;
  }
  return <MainApp />;
};

export default App;
