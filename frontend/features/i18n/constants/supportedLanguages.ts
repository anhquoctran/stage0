/** Canonical app locale catalog used by both language controls. */
export const SUPPORTED_LANGUAGES = [
  { code: 'en', nativeName: 'English', group: 'base', launchTranslation: 'source', dayjsLocale: 'en', dayjsImportPath: null, rtl: false },
  { code: 'vi', nativeName: 'Tiếng Việt', group: 'base', launchTranslation: 'real', dayjsLocale: 'vi', dayjsImportPath: 'dayjs/locale/vi', rtl: false },
  { code: 'ja', nativeName: '日本語', group: 'extended', launchTranslation: 'real', dayjsLocale: 'ja', dayjsImportPath: 'dayjs/locale/ja', rtl: false },
  { code: 'ko', nativeName: '한국어', group: 'extended', launchTranslation: 'real', dayjsLocale: 'ko', dayjsImportPath: 'dayjs/locale/ko', rtl: false },
  { code: 'zh-Hans', nativeName: '简体中文', group: 'extended', launchTranslation: 'real', dayjsLocale: 'zh-cn', dayjsImportPath: 'dayjs/locale/zh-cn', rtl: false },
  { code: 'es', nativeName: 'Español', group: 'extended', launchTranslation: 'real', dayjsLocale: 'es', dayjsImportPath: 'dayjs/locale/es', rtl: false },
  { code: 'pt-BR', nativeName: 'Português (Brasil)', group: 'extended', launchTranslation: 'real', dayjsLocale: 'pt-br', dayjsImportPath: 'dayjs/locale/pt-br', rtl: false },
  { code: 'de', nativeName: 'Deutsch', group: 'extended', launchTranslation: 'real', dayjsLocale: 'de', dayjsImportPath: 'dayjs/locale/de', rtl: false },
  { code: 'fr', nativeName: 'Français', group: 'extended', launchTranslation: 'real', dayjsLocale: 'fr', dayjsImportPath: 'dayjs/locale/fr', rtl: false },
  { code: 'ru', nativeName: 'Русский', group: 'extended', launchTranslation: 'real', dayjsLocale: 'ru', dayjsImportPath: 'dayjs/locale/ru', rtl: false },
  { code: 'zh-Hant', nativeName: '繁體中文', group: 'extended', launchTranslation: 'placeholder', dayjsLocale: 'zh-tw', dayjsImportPath: 'dayjs/locale/zh-tw', rtl: false },
  { code: 'it', nativeName: 'Italiano', group: 'extended', launchTranslation: 'placeholder', dayjsLocale: 'it', dayjsImportPath: 'dayjs/locale/it', rtl: false },
  { code: 'pt-PT', nativeName: 'Português (Portugal)', group: 'extended', launchTranslation: 'placeholder', dayjsLocale: 'pt', dayjsImportPath: 'dayjs/locale/pt', rtl: false },
  { code: 'ar', nativeName: 'العربية', group: 'extended', launchTranslation: 'placeholder', dayjsLocale: 'ar', dayjsImportPath: 'dayjs/locale/ar', rtl: true },
] as const;
