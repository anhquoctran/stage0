import { type SandboxType } from '../../git/types/SandboxType';

export interface SandboxTabProps {
  draftSandboxType: SandboxType;
  onSelectAdapter: (type: SandboxType) => void;
  isPendingCommit?: boolean;
}
