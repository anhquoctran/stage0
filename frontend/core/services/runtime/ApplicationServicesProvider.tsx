import type { ReactNode } from 'react';
import { ApplicationServicesContext } from './ApplicationServicesContext';
import { getApplicationServices } from './applicationRuntime';

/** React and non-React workflows receive the same window-scoped runtime. */
export function ApplicationServicesProvider({ children }: { children: ReactNode }) {
  return (
    <ApplicationServicesContext.Provider value={getApplicationServices()}>
      {children}
    </ApplicationServicesContext.Provider>
  );
}
