import { getApplicationServices } from '../../../core/services/runtime/applicationRuntime';
import { useGitStore } from '../../git/store/useGitStore';
import i18n from '../../i18n/i18n';

export const PREFERENCES_WINDOW_LABEL = 'preferences';

export function isPreferencesWindow(): boolean {
  const { platform } = getApplicationServices();
  return platform.capabilities.windows && platform.windows.current().label === PREFERENCES_WINDOW_LABEL;
}

/** Return true when Rust owns the request; never open an extra repo-local draft. */
export function requestPreferencesWindow(tab?: string | null): boolean {
  const services = getApplicationServices();
  if (!services.platform.capabilities.backend || !services.platform.capabilities.windows || isPreferencesWindow()) return false;
  void services.application.openPreferencesWindow({ tab: tab ?? null }).catch((error) => {
    useGitStore.getState().showToast(i18n.t('preferences.window.openError', { error: String(error) }), 'error');
  });
  return true;
}
