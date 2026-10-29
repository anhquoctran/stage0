import { WindowControls } from '../../../core/components/layout/WindowControls';
import { titleBarMouseDown } from '../../../core/components/layout/top-bar/titleBarMouseDown';
import { useApplicationServices } from '../../../core/services/runtime/useApplicationServices';
import { useWindowChromeStore } from '../../../core/store/useWindowChromeStore';
import { isMacOS } from '../../../common/utils/shortcuts';

/** Keep native window actions available above the onboarding save fieldset. */
export function OnboardingWindowChrome() {
  const services = useApplicationServices();
  const profile = useWindowChromeStore((state) => state.profile);
  const mac = profile.platform === 'macos' || (!profile.platform && isMacOS()) ||
    (typeof window !== 'undefined' && window.location.search.includes('platform=mac'));
  const linux = profile.platform === 'linux';
  if (profile.nativeFrame) return null;

  return (
    <div
      dir="ltr"
      data-tauri-drag-region={!linux}
      onMouseDown={titleBarMouseDown(profile, services.application, mac)}
      className="absolute inset-x-0 top-0 z-30 flex h-8.5 items-center justify-between rounded-none bg-transparent cursor-default"
    >
      <div className="flex h-full items-center ps-3">
        {mac ? <WindowControls style="mac" /> : linux && profile.controlsLeft.length > 0
          ? <WindowControls style="windows" buttons={profile.controlsLeft} /> : null}
      </div>
      <div className="flex h-full items-center">
        {!mac && <WindowControls style="windows" buttons={linux ? profile.controlsRight : undefined} />}
      </div>
    </div>
  );
}
