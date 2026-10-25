import { createContext } from 'react';
import type { ApplicationServices } from './ApplicationServices';

export const ApplicationServicesContext = createContext<ApplicationServices | null>(null);
