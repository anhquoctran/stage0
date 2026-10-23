import type { MarkdownFontSettings } from '../types/MarkdownFontSettings';

export function applyMarkdownFontToDocument(settings: MarkdownFontSettings) {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;

  if (settings.editorFontFamily) {
    root.style.setProperty(
      '--markdown-editor-font-family',
      `"${settings.editorFontFamily}", var(--viewer-font-family, monospace)`
    );
  } else {
    root.style.removeProperty('--markdown-editor-font-family');
  }

  if (settings.fontFamily) {
    root.style.setProperty(
      '--markdown-font-family',
      `"${settings.fontFamily}", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
    );
  } else {
    root.style.removeProperty('--markdown-font-family');
  }

  if (settings.codeFontFamily) {
    root.style.setProperty(
      '--markdown-code-font-family',
      `"${settings.codeFontFamily}", "Fira Code", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`
    );
  } else {
    root.style.removeProperty('--markdown-code-font-family');
  }

  if (settings.fontSize) {
    root.style.setProperty('--markdown-font-size', `${settings.fontSize}px`);
  } else {
    root.style.removeProperty('--markdown-font-size');
  }

  if (settings.headingFontWeight) {
    root.style.setProperty('--markdown-heading-weight', String(settings.headingFontWeight));
  } else {
    root.style.removeProperty('--markdown-heading-weight');
  }
}
