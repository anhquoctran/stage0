import { SUPPORTED_LANGUAGES } from '../constants/supportedLanguages';
import type { AppLanguage } from '../types/AppLanguage';

export function isAppLanguage(value: unknown): value is AppLanguage {
  return typeof value === 'string' && SUPPORTED_LANGUAGES.some((language) => language.code === value);
}

export function languageFor(code: string) {
  return SUPPORTED_LANGUAGES.find((language) => language.code === code) ?? SUPPORTED_LANGUAGES[0];
}
