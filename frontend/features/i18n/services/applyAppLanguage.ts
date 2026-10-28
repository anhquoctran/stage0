import i18n from '../i18n';
import { applyDayjsLocale } from '../utils/applyDayjsLocale';

/** Switch both UI translations and date formatting from the persisted app locale. */
export async function applyAppLanguage(appLanguage: string): Promise<void> {
  await applyDayjsLocale(appLanguage);
  await i18n.changeLanguage(appLanguage);
}
