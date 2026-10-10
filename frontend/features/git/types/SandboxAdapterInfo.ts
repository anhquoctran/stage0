import type { SandboxType } from './SandboxType';
import type { SandboxCapabilities } from './SandboxCapabilities';

export interface SandboxAdapterInfo {
  adapter_type: SandboxType;
  name: string;
  description: string;
  is_available: boolean;
  version_info?: string | null;
  status_message: string;
  capabilities: SandboxCapabilities;
}
