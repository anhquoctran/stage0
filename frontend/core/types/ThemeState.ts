import type { ThemeMode } from './ThemeMode';
import type { ThemeId } from './ThemeId';

export interface ThemeState {
  themeMode: ThemeMode;
  theme: ThemeId;
  setThemeMode: (mode: ThemeMode) => void;
  setTheme: (theme: ThemeId) => void;
  toggleTheme: () => void;
}
