import type { CloneOptions } from './CloneOptions';
import type { RemoteCloneRefs } from './RemoteCloneRefs';

export interface CloneOptionsFormProps {
  options: CloneOptions;
  onChange: (options: CloneOptions) => void;
  disabled: boolean;
  remoteRefs?: RemoteCloneRefs | null;
  refsLoading?: boolean;
}
