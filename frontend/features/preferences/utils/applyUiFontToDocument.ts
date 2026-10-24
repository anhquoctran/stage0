import { DEFAULT_UI_FONT_FAMILY } from '../constants/uiFonts';

export function applyUiFontToDocument(fontFamily = DEFAULT_UI_FONT_FAMILY): void {
  if (typeof document === 'undefined') return;
  document.documentElement.style.setProperty(
    '--font-sans',
    `${JSON.stringify(fontFamily)}, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
  );
}
