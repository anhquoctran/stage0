import i18n from 'i18next';
import { configureBackendMessages } from '../../common/services/ipc/backendMessages';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import vi from './locales/vi.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';
import zhHans from './locales/zh-Hans.json';
import es from './locales/es.json';
import ptBr from './locales/pt-BR.json';
import de from './locales/de.json';
import fr from './locales/fr.json';
import ru from './locales/ru.json';
import zhHant from './locales/zh-Hant.json';
import it from './locales/it.json';
import ptPt from './locales/pt-PT.json';
import ar from './locales/ar.json';
import { SUPPORTED_LANGUAGES } from './constants/supportedLanguages';

const resources = {
  en: { translation: en },
  vi: { translation: vi },
  ja: { translation: ja },
  ko: { translation: ko },
  'zh-Hans': { translation: zhHans },
  es: { translation: es },
  'pt-BR': { translation: ptBr },
  de: { translation: de },
  fr: { translation: fr },
  ru: { translation: ru },
  'zh-Hant': { translation: zhHant },
  it: { translation: it },
  'pt-PT': { translation: ptPt },
  ar: { translation: ar },
} as const;

void i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  supportedLngs: SUPPORTED_LANGUAGES.map(({ code }) => code),
  load: 'currentOnly',
  interpolation: { escapeValue: false },
  returnNull: false,
  compatibilityJSON: 'v4',
  react: { useSuspense: false },
});

configureBackendMessages((code, params) => i18n.t(code, { ...params, defaultValue: i18n.t('backend.errors.operation') }));

export default i18n;
