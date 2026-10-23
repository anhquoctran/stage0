import React from 'react';
import type { AcpAgentConfig } from '../types/AcpAgentConfig';

export interface AcpAgentPromptContext {
  detailAgent: AcpAgentConfig | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  currentRepoPath: string | null;
}
