import React from 'react';
import type { AcpAgentConfig } from '../types/AcpAgentConfig';

export interface CustomAcpAgentFormContext {
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  updateExternalAgents: (agents: AcpAgentConfig[]) => void;
  externalAgents: AcpAgentConfig[];
  setIsCustomOpen: React.Dispatch<React.SetStateAction<boolean>>;
}
