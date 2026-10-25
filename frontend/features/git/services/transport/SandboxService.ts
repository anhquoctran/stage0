import type { SandboxAdapterInfo } from '../../types/SandboxAdapterInfo';
import type { SandboxExecutionResult } from '../../types/SandboxExecutionResult';
import type { SandboxInstanceInfo } from '../../types/SandboxInstanceInfo';
import type { SandboxType } from '../../types/SandboxType';

/** Feature-owned backend contract. Inputs retain the existing wire field names. */
export interface SandboxService {
  createSandboxInstance(input: {
    repoPath: string;
    base: string;
    compare: string;
  }): Promise<SandboxInstanceInfo>;
  destroySandboxInstance(input: {
    instanceId: string;
  }): Promise<unknown>;
  executeSandboxCommand(input: {
    instanceId: string;
    command: string;
    args: string[];
  }): Promise<SandboxExecutionResult>;
  getActiveSandbox(): Promise<SandboxType>;
  getAvailableSandboxes(): Promise<SandboxAdapterInfo[]>;
  setActiveSandbox(input: {
    adapterType: SandboxType;
  }): Promise<SandboxType>;
}
