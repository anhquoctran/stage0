import React from 'react';
import type { AcpRegistryAgent } from '../../types/AcpAgentConfig';

export interface AcpRegistryActionsProps {
  onBackToOverview: (() => void) | undefined;
  setIsCustomOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isLoading: boolean;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setRegistry: React.Dispatch<React.SetStateAction<AcpRegistryAgent[]>>;
  setSupportedBinaryTarget: React.Dispatch<React.SetStateAction<string | undefined>>;
  isOnboarding?: boolean;
}
