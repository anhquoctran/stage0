import '@testing-library/jest-dom/vitest';
import { afterEach, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import english from '../../frontend/features/i18n/locales/en.json';

beforeAll(async () => {
  const i18n = createInstance();
  await i18n.use(initReactI18next).init({
    lng: 'en', fallbackLng: 'en', resources: { en: { translation: english } },
    interpolation: { escapeValue: false },
  });
});

afterEach(cleanup);

// JSDOM has no layout/scroll engine. Mock only this browser API; React, hooks,
// portals, event propagation and focus use their real implementations.
if (!Element.prototype.scrollIntoView) {
  Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value() {} });
}
