import type { AppLanguage } from '../../i18n/types/AppLanguage';
import type { GreetingArtwork } from '../types/GreetingArtwork';
import latin from '../assets/greetings/latin.json';
import cyrillic from '../assets/greetings/cyrillic.json';
import cjk from '../assets/greetings/cjk.json';
import korean from '../assets/greetings/korean.json';
import arabic from '../assets/greetings/arabic.json';

/** All artwork is bundled; greetings never depend on installed system fonts. */
export const GREETING_ARTWORK: Record<AppLanguage, GreetingArtwork> = {
  en: latin.en,
  vi: latin.vi,
  ja: { ...cjk.ja, attribution: cjk.attribution },
  ko: korean.ko,
  'zh-Hans': { ...cjk.zh, attribution: cjk.attribution },
  es: latin.es,
  'pt-BR': latin['pt-BR'],
  de: latin.de,
  fr: latin.fr,
  ru: cyrillic.ru,
  'zh-Hant': { ...cjk.zh, attribution: cjk.attribution },
  it: latin.it,
  'pt-PT': latin['pt-BR'],
  ar: arabic.ar,
};
