import type { Unsubscribe } from '../../../common/services/ipc/contracts/Unsubscribe';
import { getApplicationServices } from './applicationRuntime';
import i18n from '../../../features/i18n/i18n';
import type { AppLanguage } from '../../../features/i18n/types/AppLanguage';
import { isAppLanguage } from '../../../features/i18n/utils/language';
import { applyDayjsLocale } from '../../../features/i18n/utils/applyDayjsLocale';
import { applyDocumentDirection } from '../../../features/i18n/utils/applyDocumentDirection';
import { DEFAULT_APP_LANGUAGE } from '../../../features/i18n/constants/defaultLanguages';

type AppLanguageChanged = { language: string };

let startPromise: Promise<(persistedLanguage: unknown) => Promise<void>> | undefined;

/** Subscribe once per WebView and defer events until persisted bootstrap is known. */
export function startGlobalLanguageRuntime(): Promise<(persistedLanguage: unknown) => Promise<void>> {
  if (startPromise) return startPromise;
  startPromise = start();
  return startPromise;
}

async function start(): Promise<(persistedLanguage: unknown) => Promise<void>> {
  const services = getApplicationServices();
  let ready = false;
  let pendingLanguage: AppLanguage | undefined;
  let applyQueue = Promise.resolve();
  let unlisten: Unsubscribe | undefined;
  const apply = (language: AppLanguage) => {
    applyQueue = applyQueue.then(async () => {
      await applyDayjsLocale(language);
      applyDocumentDirection(language);
      await i18n.changeLanguage(language);
    }).catch((error) => console.error('[Stage0 i18n] Could not apply application language:', error));
  };

  if (services.platform.capabilities.backend) {
    unlisten = await services.platform.events.subscribe<AppLanguageChanged>(
      'app-language-changed',
      (payload) => {
        if (!payload || !isAppLanguage(payload.language)) return;
        if (!ready) pendingLanguage = payload.language;
        else apply(payload.language);
      },
      { target: { kind: 'application' } },
    );
  }
  if (unlisten) window.addEventListener('beforeunload', unlisten, { once: true });
  return async (persistedLanguage) => {
    const initial = pendingLanguage ?? (isAppLanguage(persistedLanguage) ? persistedLanguage : DEFAULT_APP_LANGUAGE);
    pendingLanguage = undefined;
    ready = true;
    apply(initial);
    await applyQueue;
  };
}
