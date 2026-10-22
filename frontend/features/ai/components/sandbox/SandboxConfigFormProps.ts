import { type SandboxType } from '../../../git/types/SandboxType';

export interface SandboxConfigFormProps {
  adapters: {
    id: SandboxType;
    title: string;
    defaultBadge?: boolean;
    description: string;
    specs: string;
    extraBadge?: string;
  }[];
  draftSandboxType: SandboxType;
  committedSandboxType: SandboxType;
  onSelectAdapter: (type: SandboxType) => void;
}
