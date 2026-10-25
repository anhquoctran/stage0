import type { StartupPhase } from './StartupPhase';
import type { StartupWindowHandoff } from './StartupWindowHandoff';

function controller() {
  return typeof window === 'undefined' ? undefined : window.__STAGE0_STARTUP__;
}

/** The static splash owns presentation even before the React bundle is loaded. */
export const startupProgress = {
  begin: (phase: StartupPhase) => controller()?.begin(phase),
  update: (phase: StartupPhase, fraction: number) => controller()?.update(phase, fraction),
  complete: (phase: StartupPhase) => controller()?.complete(phase),
  fail: () => controller()?.fail(),
  finish: (handoff?: StartupWindowHandoff) => controller()?.finish(handoff) ?? (() => {}),
};
