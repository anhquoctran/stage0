import type { AppLanguage } from '../../i18n/types/AppLanguage';

export interface OnboardingLanguagePickerProps {
  value: AppLanguage;
  disabled: boolean;
  onChange: (language: AppLanguage) => void;
}
