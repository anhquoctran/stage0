import dayjs from 'dayjs';
import { languageFor } from './language';

const localeLoaders: Record<string, () => Promise<unknown>> = {
  vi: () => import('dayjs/locale/vi.js'),
  ja: () => import('dayjs/locale/ja.js'),
  ko: () => import('dayjs/locale/ko.js'),
  'zh-Hans': () => import('dayjs/locale/zh-cn.js'),
  es: () => import('dayjs/locale/es.js'),
  'pt-BR': () => import('dayjs/locale/pt-br.js'),
  de: () => import('dayjs/locale/de.js'),
  fr: () => import('dayjs/locale/fr.js'),
  ru: () => import('dayjs/locale/ru.js'),
  'zh-Hant': () => import('dayjs/locale/zh-tw.js'),
  it: () => import('dayjs/locale/it.js'),
  'pt-PT': () => import('dayjs/locale/pt.js'),
  ar: () => import('dayjs/locale/ar.js'),
  hi: () => import('dayjs/locale/hi.js'),
};

/** Applies the Day.js locale derived from the one persisted app language. */
export async function applyDayjsLocale(appLanguage: string): Promise<void> {
  const locale = languageFor(appLanguage);
  const load = localeLoaders[locale.code];
  if (load) await load();
  dayjs.locale(locale.dayjsLocale);
}
