import { create } from 'zustand';
import { isPrimaryAppWindow } from '../../../core/utils/isPrimaryAppWindow';
import { shouldShowFirstLaunchWelcome } from '../components/FirstLaunchWelcome';
import type { OnboardingStoreState } from '../types/OnboardingStoreState';

export const useOnboardingStore = create<OnboardingStoreState>((set) => ({
  isOnboardingOpen: typeof window !== 'undefined' && isPrimaryAppWindow() && shouldShowFirstLaunchWelcome(),
  setOnboardingOpen: (isOnboardingOpen: boolean) => set({ isOnboardingOpen }),
}));
