import { useEffect, useLayoutEffect } from 'react';
import { clsx } from 'clsx';
import { useDesktopWindowChrome } from '../../../core/hooks/useDesktopWindowChrome';
import { useWindowFrameClipping } from '../../../core/hooks/useWindowFrameClipping';
import { useWindowChromeStore } from '../../../core/store/useWindowChromeStore';
import { usePreferencesStore } from '../store/usePreferencesStore';
import { useGitStore } from '../../git/store/useGitStore';
import { PreferencesModal } from './PreferencesModal';
import { MenuBar } from '../../../core/components/layout/MenuBar';
import { CloneRepoModal } from '../../git/components/CloneRepoModal';
import { notificationService } from '../../notifications/services/notificationService';
import { isMacOS } from '../../../common/utils/shortcuts';

/** App-wide utility surface; never initializes/owns a repository or onboarding. */
export function PreferencesWindow() {
  useDesktopWindowChrome();
  const profile = useWindowChromeStore(state => state.profile);
  useEffect(() => {
    void notificationService.init();
    const refreshRecents = () => { void useGitStore.getState().loadRecentRepos(); };
    refreshRecents();
    window.addEventListener('focus', refreshRecents);
    return () => {
      notificationService.destroy();
      window.removeEventListener('focus', refreshRecents);
    };
  }, []);
  const toast = useGitStore(state => state.toastMessage);
  useLayoutEffect(() => {
    document.getElementById('startup-splash')?.remove();
    if (isMacOS()) {
      document.documentElement.classList.add('transparent-window');
      document.body.classList.add('transparent-window');
      document.documentElement.style.backgroundColor = 'transparent';
      document.body.style.backgroundColor = 'transparent';
    }
    usePreferencesStore.getState().openPreferences();
  }, []);
  const isMac = profile.platform === 'macos' || (!profile.platform && isMacOS());
  const isCustomMac = isMac && !profile.nativeFrame;
  // The transparent gutter contains the shadow; clip content inside the frame.
  useWindowFrameClipping(false);

  return (
    <div className={clsx('flex h-screen w-screen overflow-hidden text-text', isCustomMac && 'p-4')}>
      <div id="preferences-window-content" className={clsx('relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-base contain-layout',
        profile.nativeFrame ? 'border-0 rounded-none' : 'border border-surface0/50',
        isCustomMac ? 'rounded-(--window-frame-radius) preferences-window-shadow' : 'rounded-none',
      )}>
        <PreferencesModal standalone />
        <MenuBar hidden />
        <CloneRepoModal />
        {toast && <div role="status" className="pointer-events-none absolute bottom-12 end-4 z-50 rounded-sm border border-surface0 bg-mantle px-3 py-2 text-xs shadow-lg">{toast}</div>}
      </div>
    </div>
  );
}
