import { create } from 'zustand';
import type { CatppuccinTheme } from '../types/CatppuccinTheme';
import type { ThemeMode } from '../types/ThemeMode';
import type { ThemeState } from '../types/ThemeState';

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
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // ignore
    }
    const resolved = resolveTheme(mode);
    applyThemeToDocument(resolved);
    set({ themeMode: mode, theme: resolved });
  },

  setTheme: (theme: CatppuccinTheme) => {
    const mode: ThemeMode = theme === 'mocha-light' ? 'light' : 'dark';
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // ignore
    }
    applyThemeToDocument(theme);
    set({ themeMode: mode, theme });
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

export type { ThemeMode } from '../types/ThemeMode';
export type { CatppuccinTheme } from '../types/CatppuccinTheme';
