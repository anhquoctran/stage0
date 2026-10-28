import { SUPPORTED_LANGUAGES } from '../constants/supportedLanguages';

export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number]['code'];
