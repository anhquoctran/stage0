import { create } from 'zustand';
import { SUPPORTED_FONTS } from '../constants/fonts';

export interface ViewerFontSettings {
  fontFamily: string;
  fontSize: number;
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  lineSpacing: number;
  enableLigatures: boolean;
}

interface PreferencesState extends ViewerFontSettings {
  isPreferencesOpen: boolean;
  setIsPreferencesOpen: (open: boolean) => void;
  updateViewerFontSettings: (settings: Partial<ViewerFontSettings>) => void;
  resetViewerFontSettings: () => void;
}

const STORAGE_KEY = 'stage0_viewer_font_settings';

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

export const usePreferencesStore = create<PreferencesState>((set, get) => ({
  ...initialSettings,
  isPreferencesOpen: false,

  setIsPreferencesOpen: (open: boolean) => set({ isPreferencesOpen: open }),

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

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }

    applyViewerFontToDocument(updated);
    set(updated);
  },

  resetViewerFontSettings: () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_VIEWER_FONT_SETTINGS));
    } catch {
      // ignore
    }

    applyViewerFontToDocument(DEFAULT_VIEWER_FONT_SETTINGS);
    set(DEFAULT_VIEWER_FONT_SETTINGS);
  },
}));
