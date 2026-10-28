import { useTranslation } from 'react-i18next';

/** Subscribes date-rendering components to app locale changes. */
export function useDateTimeLanguage(): string {
  const { i18n } = useTranslation();
  return i18n.resolvedLanguage ?? i18n.language;
}
