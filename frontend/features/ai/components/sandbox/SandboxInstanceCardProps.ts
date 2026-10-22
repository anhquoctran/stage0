import React from 'react';
import type { SandboxInstanceInfo } from '../../../git/types/SandboxInstanceInfo';

export interface SandboxInstanceCardProps {
  inst: SandboxInstanceInfo;
  setSelectedInstanceId: React.Dispatch<React.SetStateAction<string>>;
  selectedInstanceId: string;
  activeSandboxInstances: SandboxInstanceInfo[];
  destroySandboxInstance: (id: string) => Promise<void>;
}
