import type { GitState } from '../../git/types/GitState';
import type { RepoInfo } from '../../git/types/RepoInfo';
import type { SandboxExecutionResult } from '../../git/types/SandboxExecutionResult';
import type { SandboxInstanceInfo } from '../../git/types/SandboxInstanceInfo';
export interface SandboxCommandContext {
  currentRepo: RepoInfo | null;
  showToast: (msg: string, level?: GitState['toastLevel']) => void;
  isPendingCommit: boolean;
  createSandboxInstance: () => Promise<SandboxInstanceInfo | null>;
  activeSandboxInstances: SandboxInstanceInfo[];
  executeSandboxCommand: (
    id: string,
    command: string,
    args: string[]
  ) => Promise<SandboxExecutionResult | null>;
}
