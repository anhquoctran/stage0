import { create } from 'zustand';

export type CatppuccinTheme = 'mocha' | 'mocha-light';

interface ThemeState {
  theme: CatppuccinTheme;
  setTheme: (theme: CatppuccinTheme) => void;
  toggleTheme: () => void;
}

const STORAGE_KEY = 'stage0_catppuccin_theme';

export function applyThemeToDocument(theme: CatppuccinTheme) {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  root.setAttribute('data-theme', theme);

  root.classList.remove('mocha', 'mocha-light', 'mocha-oled', 'latte', 'light', 'dark');

  if (theme === 'mocha-light' || (theme as string) === 'latte') {
    root.classList.add('light', 'mocha-light', 'latte');
    root.style.colorScheme = 'light';
  } else {
    root.classList.add('dark', 'mocha');
    root.style.colorScheme = 'dark';
  }

  document.body.style.backgroundColor = 'var(--ctp-crust)';
  document.body.style.color = 'var(--ctp-text)';
}

function getInitialTheme(): CatppuccinTheme {
  if (typeof window === 'undefined') return 'mocha';
  const saved = localStorage.getItem(STORAGE_KEY) as string | null;
  if (saved === 'mocha-light' || saved === 'latte') {
    return 'mocha-light';
  }
  return 'mocha';
}

const initialTheme = getInitialTheme();
applyThemeToDocument(initialTheme);

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: initialTheme,

  setTheme: (theme: CatppuccinTheme) => {
    localStorage.setItem(STORAGE_KEY, theme);
    applyThemeToDocument(theme);
    set({ theme });
  },

  toggleTheme: () => {
    const nextTheme: CatppuccinTheme =
      get().theme === 'mocha' ? 'mocha-light' : 'mocha';
    localStorage.setItem(STORAGE_KEY, nextTheme);
    applyThemeToDocument(nextTheme);
    set({ theme: nextTheme });
  },
}));
