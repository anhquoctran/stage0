import { useEffect, useLayoutEffect, useState } from 'react';
import { clsx } from 'clsx';
import { useDesktopWindowChrome } from '../../../core/hooks/useDesktopWindowChrome';
import { useWindowChromeStore } from '../../../core/store/useWindowChromeStore';
import { usePreferencesStore } from '../store/usePreferencesStore';
import { useGitStore } from '../../git/store/useGitStore';
import { PreferencesModal } from './PreferencesModal';
import { MenuBar } from '../../../core/components/layout/MenuBar';
import { CloneRepoModal } from '../../git/components/CloneRepoModal';
import { useApplicationServices } from '../../../core/services/runtime/useApplicationServices';
import { notificationService } from '../../notifications/services/notificationService';

/** App-wide utility surface; never initializes/owns a repository or onboarding. */
export function PreferencesWindow() {
  useDesktopWindowChrome();
  const profile = useWindowChromeStore(state => state.profile);
  const services = useApplicationServices();
  const [expanded, setExpanded] = useState(false);
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
  useEffect(() => {
    let disposed = false;
    let version = 0;
    const refresh = async () => {
      const request = ++version;
      try {
        const [maximized, fullscreen] = await Promise.all([
          services.application.windowIsMaximized(), services.application.windowIsFullscreen(),
        ]);
        if (!disposed && request === version) setExpanded(maximized || fullscreen);
      } catch { /* Browser preview has no native window geometry. */ }
    };
    void refresh();
    window.addEventListener('resize', refresh);
    return () => { disposed = true; window.removeEventListener('resize', refresh); };
  }, [services]);
  const toast = useGitStore(state => state.toastMessage);
  useLayoutEffect(() => {
    document.getElementById('startup-splash')?.remove();
    usePreferencesStore.getState().openPreferences();
  }, []);
  return (
    <div className={clsx('relative flex h-screen w-screen flex-col overflow-hidden bg-mantle text-text',
      profile.nativeFrame || expanded ? 'border-0 rounded-none' : 'border border-surface0',
      profile.platform === 'macos' && !profile.nativeFrame && !expanded ? 'rounded-sm' : 'rounded-none',
    )}>
      <PreferencesModal standalone />
      <MenuBar hidden />
      <CloneRepoModal />
      {toast && <div role="status" className="pointer-events-none absolute bottom-12 end-4 z-50 rounded-sm border border-surface0 bg-mantle px-3 py-2 text-xs shadow-lg">{toast}</div>}
    </div>
  );
}
