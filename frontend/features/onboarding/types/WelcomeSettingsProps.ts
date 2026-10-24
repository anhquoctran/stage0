import type { Dispatch, SetStateAction } from 'react';
import type { WELCOME_SLIDES } from '../constants/welcomeSlides';
import type { OnboardingPreferences } from './OnboardingPreferences';

export interface WelcomeSettingsProps {
  step: typeof WELCOME_SLIDES[number]['id'];
  settings: OnboardingPreferences;
  onChange: Dispatch<SetStateAction<OnboardingPreferences>>;
}
