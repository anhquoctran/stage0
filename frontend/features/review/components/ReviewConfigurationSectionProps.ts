import type { VirtualMrSession } from '../../virtual-mr/types/VirtualMrSession';

export interface ReviewConfigurationSectionProps {
  session: VirtualMrSession | null;
  close: () => void;
  running: boolean;
  cancel: () => Promise<void>;
}
