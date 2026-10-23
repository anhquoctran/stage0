import React from 'react';
import type { AcpAgentConfig } from '../types/AcpAgentConfig';

export interface AcpAgentAccountContext {
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  detailAgent: AcpAgentConfig | null;
  setBusyId: React.Dispatch<React.SetStateAction<string | null>>;
  setNotice: React.Dispatch<React.SetStateAction<string | null>>;
}
