import type { ReactNode } from 'react';

export interface WelcomeArtworkSceneProps {
  step: 'welcome' | 'compare' | 'review';
  children: ReactNode;
}
