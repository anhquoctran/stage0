import { create } from 'zustand';
import { SUPPORTED_FONTS } from '../constants/fonts';
import type { ViewerFontSettings } from '../types/ViewerFontSettings';
import type { PreferencesState } from '../types/PreferencesState';
import { preferencesJsonService } from '../services/preferencesJsonService';

const STORAGE_KEY = 'stage0_viewer_font_settings';

const INLINE_BLAME_STORAGE_KEY = 'stage0_show_inline_blame';

export const DEFAULT_VIEWER_FONT_SETTINGS: ViewerFontSettings = {
  fontFamily: 'Fira Code',
  fontSize: 13,
  isBold: false,
  isItalic: false,
  isUnderline: false,
  lineSpacing: 1.5,
  enableLigatures: true,
};

export function checkFontLigaturesSupport(fontFamilyName: string): boolean {
  const font = SUPPORTED_FONTS.find(
    (f) => f.fontFamilyName.toLowerCase() === fontFamilyName.toLowerCase()
  );
  return font ? font.ligaturesSupport : false;
}

export function applyViewerFontToDocument(settings: ViewerFontSettings) {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const supportsLigatures = checkFontLigaturesSupport(settings.fontFamily);
  const ligaturesActive = settings.enableLigatures && supportsLigatures;

  root.style.setProperty(
    '--viewer-font-family',
    `"${settings.fontFamily}", "Fira Code", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`
  );
  root.style.setProperty('--viewer-font-size', `${settings.fontSize}px`);
  root.style.setProperty('--viewer-font-weight', settings.isBold ? '700' : '400');
  root.style.setProperty('--viewer-font-style', settings.isItalic ? 'italic' : 'normal');
  root.style.setProperty(
    '--viewer-text-decoration',
    settings.isUnderline ? 'underline' : 'none'
  );
  root.style.setProperty('--viewer-line-height', String(settings.lineSpacing));
  root.style.setProperty(
    '--viewer-font-ligatures',
    ligaturesActive ? 'normal' : 'none'
  );
  root.style.setProperty(
    '--viewer-font-features',
    ligaturesActive ? '"liga" 1, "calt" 1' : '"liga" 0, "calt" 0'
  );
}

function getInitialSettings(): ViewerFontSettings {
  if (typeof window === 'undefined') return DEFAULT_VIEWER_FONT_SETTINGS;

  const configured = window.__STAGE0_PREFERENCES__?.appearance?.viewerFont;
  if (configured && typeof configured === 'object') {
    return { ...DEFAULT_VIEWER_FONT_SETTINGS, ...(configured as Partial<ViewerFontSettings>) };
  }

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...DEFAULT_VIEWER_FONT_SETTINGS,
        ...parsed,
      };
    }
  } catch (err) {
    console.warn('Failed to parse saved viewer font settings:', err);
  }

  return DEFAULT_VIEWER_FONT_SETTINGS;
}

const initialSettings = getInitialSettings();

applyViewerFontToDocument(initialSettings);

function getInitialInlineBlame(): boolean {
  if (typeof window === 'undefined') return true;
  const configured = window.__STAGE0_PREFERENCES__?.general?.showInlineBlame;
  if (typeof configured === 'boolean') return configured;
  try {
    const val = localStorage.getItem(INLINE_BLAME_STORAGE_KEY);
    return val !== 'false';
  } catch {
    return true;
  }
}

export const usePreferencesStore = create<PreferencesState>((set, get) => ({
  ...initialSettings,
  isPreferencesOpen: false,
  initialPreferencesTab: null,
  showInlineBlame: getInitialInlineBlame(),

  setIsPreferencesOpen: (open: boolean) =>
    set({
      isPreferencesOpen: open,
      initialPreferencesTab: open ? get().initialPreferencesTab : null,
    }),

  setInitialPreferencesTab: (tab: string | null) =>
    set({ initialPreferencesTab: tab }),

  openPreferences: (tab?: string) =>
    set({
      isPreferencesOpen: true,
      initialPreferencesTab: tab ?? null,
    }),

  setShowInlineBlame: (show: boolean) => {
    set({ showInlineBlame: show });
    void preferencesJsonService.patch({ general: { showInlineBlame: show } }).catch((error) => console.error('Could not save preferences.json:', error));
  },

  toggleInlineBlame: () => {
    const next = !get().showInlineBlame;
    get().setShowInlineBlame(next);
  },

  updateViewerFontSettings: (partial: Partial<ViewerFontSettings>) => {
    const current = get();
    const updated: ViewerFontSettings = {
      fontFamily: partial.fontFamily ?? current.fontFamily,
      fontSize: partial.fontSize ?? current.fontSize,
      isBold: partial.isBold ?? current.isBold,
      isItalic: partial.isItalic ?? current.isItalic,
      isUnderline: partial.isUnderline ?? current.isUnderline,
      lineSpacing: partial.lineSpacing ?? current.lineSpacing,
      enableLigatures: partial.enableLigatures ?? current.enableLigatures,
    };

    applyViewerFontToDocument(updated);
    set(updated);
    void preferencesJsonService.patch({ appearance: { viewerFont: updated } }).catch((error) => console.error('Could not save preferences.json:', error));
  },

  resetViewerFontSettings: () => {
    applyViewerFontToDocument(DEFAULT_VIEWER_FONT_SETTINGS);
    set(DEFAULT_VIEWER_FONT_SETTINGS);
    void preferencesJsonService.patch({ appearance: { viewerFont: DEFAULT_VIEWER_FONT_SETTINGS } }).catch((error) => console.error('Could not save preferences.json:', error));
  },
}));

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('stage0-preferences-updated', (event) => {
    const settings = (event as CustomEvent<Window['__STAGE0_PREFERENCES__']>).detail;
    const font = settings?.appearance?.viewerFont;
    const general = settings?.general;
    if (font && typeof font === 'object') {
      const next = { ...DEFAULT_VIEWER_FONT_SETTINGS, ...(font as Partial<ViewerFontSettings>) };
      applyViewerFontToDocument(next);
      usePreferencesStore.setState(next);
    }
    if (typeof general?.showInlineBlame === 'boolean') usePreferencesStore.setState({ showInlineBlame: general.showInlineBlame });
  });
}

export type { ViewerFontSettings } from '../types/ViewerFontSettings';
