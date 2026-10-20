import { create } from 'zustand';
import type { CatppuccinTheme } from '../types/CatppuccinTheme';
import type { ThemeMode } from '../types/ThemeMode';
import type { ThemeState } from '../types/ThemeState';
import { preferencesJsonService } from '../../features/preferences/services/preferencesJsonService';

const STORAGE_KEY = 'stage0_catppuccin_theme_mode';

function getSystemTheme(): CatppuccinTheme {
  if (typeof window === 'undefined') return 'mocha';
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'mocha'
    : 'mocha-light';
}

export function resolveTheme(mode: ThemeMode): CatppuccinTheme {
  if (mode === 'dark') return 'mocha';
  if (mode === 'light') return 'mocha-light';
  return getSystemTheme();
}

export function applyThemeToDocument(theme: CatppuccinTheme) {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  root.setAttribute('data-theme', theme);

  root.classList.remove('mocha', 'mocha-light', 'mocha-oled', 'latte', 'light', 'dark');

  if (theme === 'mocha-light') {
    root.classList.add('light', 'mocha-light', 'latte');
    root.style.colorScheme = 'light';
  } else {
    root.classList.add('dark', 'mocha');
    root.style.colorScheme = 'dark';
  }

  document.body.style.backgroundColor = 'var(--ctp-crust)';
  document.body.style.color = 'var(--ctp-text)';
}

function getInitialThemeMode(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  const configured = window.__STAGE0_PREFERENCES__?.appearance?.themeMode;
  if (configured === 'system' || configured === 'dark' || configured === 'light') return configured;
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'system' || saved === 'dark' || saved === 'light') {
    return saved as ThemeMode;
  }
  // Migration fallback from older key
  const oldTheme = localStorage.getItem('stage0_catppuccin_theme');
  if (oldTheme === 'mocha-light') return 'light';
  if (oldTheme === 'mocha') return 'dark';
  // Fresh installs follow the operating system until the user chooses a mode.
  return 'system';
}

const initialMode = getInitialThemeMode();

const initialResolved = resolveTheme(initialMode);

applyThemeToDocument(initialResolved);

export const useThemeStore = create<ThemeState>((set, get) => ({
  themeMode: initialMode,
  theme: initialResolved,

  setThemeMode: (mode: ThemeMode) => {
    const resolved = resolveTheme(mode);
    applyThemeToDocument(resolved);
    set({ themeMode: mode, theme: resolved });
    void preferencesJsonService.patch({ appearance: { themeMode: mode } }).catch((error) => console.error('Could not save preferences.json:', error));
  },

  setTheme: (theme: CatppuccinTheme) => {
    const mode: ThemeMode = theme === 'mocha-light' ? 'light' : 'dark';
    applyThemeToDocument(theme);
    set({ themeMode: mode, theme });
    void preferencesJsonService.patch({ appearance: { themeMode: mode } }).catch((error) => console.error('Could not save preferences.json:', error));
  },

  toggleTheme: () => {
    const nextMode: ThemeMode = get().theme === 'mocha' ? 'light' : 'dark';
    get().setThemeMode(nextMode);
  },
}));

// Listen to OS system color scheme changes
if (typeof window !== 'undefined' && window.matchMedia) {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handleMediaChange = () => {
    const { themeMode, setThemeMode } = useThemeStore.getState();
    if (themeMode === 'system') {
      setThemeMode('system');
    }
  };

  try {
    mediaQuery.addEventListener('change', handleMediaChange);
  } catch {
    // Safari / older browser fallback
    mediaQuery.addListener(handleMediaChange);
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('stage0-preferences-updated', (event) => {
    const settings = (event as CustomEvent<Window['__STAGE0_PREFERENCES__']>).detail;
    const mode = settings?.appearance?.themeMode;
    if (mode === 'system' || mode === 'dark' || mode === 'light') {
      const theme = resolveTheme(mode);
      applyThemeToDocument(theme);
      useThemeStore.setState({ themeMode: mode, theme });
    }
  });
}

export type { ThemeMode } from '../types/ThemeMode';
export type { CatppuccinTheme } from '../types/CatppuccinTheme';
