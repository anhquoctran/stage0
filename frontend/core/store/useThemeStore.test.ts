import { expect, it, vi } from 'vitest';
import { persistThemeSelection, resolveTheme } from './useThemeStore';

const selection = { darkThemeId: 'dracula', lightThemeId: 'gruvbox-light' };

it('resolves the selected palette for explicit and system modes', () => {
  const originalMatchMedia = window.matchMedia;
  const matchMedia = vi.fn((query: string) => ({
    matches: query.includes('dark'), media: query, onchange: null,
    addListener: () => {}, removeListener: () => {}, addEventListener: () => {},
    removeEventListener: () => {}, dispatchEvent: () => false,
  }));
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: matchMedia });
  expect(resolveTheme('dark', selection)).toBe('dracula');
  expect(resolveTheme('light', selection)).toBe('gruvbox-light');
  expect(resolveTheme('system', selection)).toBe('dracula');
  if (originalMatchMedia) Object.defineProperty(window, 'matchMedia', { configurable: true, value: originalMatchMedia });
  else Reflect.deleteProperty(window, 'matchMedia');
});

it('persists the selected palette IDs for first-paint startup', () => {
  persistThemeSelection(selection);
  expect(localStorage.getItem('stage0_dark_theme_id')).toBe('dracula');
  expect(localStorage.getItem('stage0_light_theme_id')).toBe('gruvbox-light');
});
