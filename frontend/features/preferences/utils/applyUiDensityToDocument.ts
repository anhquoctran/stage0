import { normalizeUiDensity } from './uiDensity';

/** Only committed settings reach the document; density never changes font/zoom. */
export function applyUiDensityToDocument(value: unknown): void {
  if (typeof document === 'undefined') return;
  document.documentElement?.setAttribute?.('data-ui-density', normalizeUiDensity(value));
}
