import { languageFor } from './language';

/** Direction is separate from locale activation so each concern can be tested independently. */
export function applyDocumentDirection(appLanguage: string): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dir = languageFor(appLanguage).rtl ? 'rtl' : 'ltr';
  document.documentElement.lang = appLanguage;
}
