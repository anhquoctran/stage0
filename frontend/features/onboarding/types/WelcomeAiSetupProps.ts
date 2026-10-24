import type { useOnboardingAiSetup } from '../hooks/useOnboardingAiSetup';

export interface WelcomeAiSetupProps {
  setup: ReturnType<typeof useOnboardingAiSetup>;
}
