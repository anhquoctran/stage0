import type { StartupPhase } from './StartupPhase';
import type { StartupWindowHandoff } from './StartupWindowHandoff';

export interface StartupProgressApi {
  begin(phase: StartupPhase): void;
  update(phase: StartupPhase, fraction: number): void;
  complete(phase: StartupPhase): void;
  fail(): void;
  /** Returns cleanup for a pending dismissal, including React StrictMode replay. */
  finish(handoff?: StartupWindowHandoff): () => void;
  readonly snapshot: {
    phase: StartupPhase;
    label: string;
    percent: number;
    step: number;
    total: number;
    status: 'loading' | 'ready' | 'error' | 'dismissed';
  };
}
