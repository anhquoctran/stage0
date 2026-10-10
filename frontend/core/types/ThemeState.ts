import type { ThemeMode } from './ThemeMode';
import type { CatppuccinTheme } from './CatppuccinTheme';

export interface ThemeState {
  themeMode: ThemeMode;
  theme: CatppuccinTheme; // Resolved theme ('mocha' | 'mocha-light')
  setThemeMode: (mode: ThemeMode) => void;
  setTheme: (theme: CatppuccinTheme) => void;
  toggleTheme: () => void;
}
