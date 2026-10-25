import { useContext } from 'react';
import { ApplicationServicesContext } from './ApplicationServicesContext';
import { getApplicationServices } from './applicationRuntime';

export function useApplicationServices() {
  return useContext(ApplicationServicesContext) ?? getApplicationServices();
}
