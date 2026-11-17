import { create } from 'zustand';
import type { ThemeId } from '../types/ThemeId';
import { applyRegisteredTheme } from '../themes/applyTheme';
import { themeColorScheme, resolvedThemeId, normalizeThemeId } from '../themes/catalog';
import type { ThemeMode } from '../types/ThemeMode';
import type { ThemeState } from '../types/ThemeState';
import { preferencesJsonService } from '../../features/preferences/services/preferencesJsonService';

const STORAGE_KEY = 'stage0_catppuccin_theme_mode';
const DARK_THEME_STORAGE_KEY = 'stage0_dark_theme_id';
const LIGHT_THEME_STORAGE_KEY = 'stage0_light_theme_id';

type ThemeSelection = Pick<ThemeState, 'darkThemeId' | 'lightThemeId'>;

function readThemeSelection(): ThemeSelection {
  const appearance = typeof window === 'undefined' ? undefined : window.__STAGE0_PREFERENCES__?.appearance;
  let savedDark: string | null = null;
  let savedLight: string | null = null;
  try {
    savedDark = localStorage.getItem(DARK_THEME_STORAGE_KEY);
    savedLight = localStorage.getItem(LIGHT_THEME_STORAGE_KEY);
  } catch { /* Preferences bootstrap remains available when browser storage is disabled. */ }
  return {
    darkThemeId: normalizeThemeId(appearance?.darkThemeId ?? savedDark, 'dark'),
    lightThemeId: normalizeThemeId(appearance?.lightThemeId ?? savedLight, 'light'),
  };
}

function readMode(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  const configured = window.__STAGE0_PREFERENCES__?.appearance?.themeMode;
  if (configured === 'system' || configured === 'dark' || configured === 'light') return configured;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'system' || saved === 'dark' || saved === 'light') return saved;
    const oldTheme = localStorage.getItem('stage0_catppuccin_theme');
    if (oldTheme === 'mocha-light') return 'light';
    if (oldTheme === 'mocha') return 'dark';
  } catch { /* Fresh installs follow the operating system. */ }
  return 'system';
}

export function resolveTheme(mode: ThemeMode, selection = readThemeSelection()): ThemeId {
  const prefersDark = typeof window === 'undefined' || typeof window.matchMedia !== 'function'
    ? true
    : window.matchMedia('(prefers-color-scheme: dark)').matches;
  const kind = mode === 'system' ? (prefersDark ? 'dark' : 'light') : mode;
  return resolvedThemeId(selection[kind === 'dark' ? 'darkThemeId' : 'lightThemeId']);
}

export function applyThemeToDocument(theme: ThemeId) {
  applyRegisteredTheme(resolvedThemeId(theme));
}

export function persistThemeMode(mode: ThemeMode) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(STORAGE_KEY, mode); } catch { /* Ignore disabled storage. */ }
}

export function persistThemeSelection(selection: ThemeSelection) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DARK_THEME_STORAGE_KEY, selection.darkThemeId);
    localStorage.setItem(LIGHT_THEME_STORAGE_KEY, selection.lightThemeId);
  } catch { /* Ignore disabled storage. */ }
}

const initialMode = readMode();
const initialSelection = readThemeSelection();
const initialTheme = resolveTheme(initialMode, initialSelection);
applyThemeToDocument(initialTheme);

export const useThemeStore = create<ThemeState>((set, get) => ({
  themeMode: initialMode,
  theme: initialTheme,
  ...initialSelection,

  setThemeMode: (mode: ThemeMode) => {
    const selection = get();
    const resolved = resolveTheme(mode, selection);
    applyThemeToDocument(resolved);
    persistThemeMode(mode);
    set({ themeMode: mode, theme: resolved });
    void preferencesJsonService.patch({ appearance: { themeMode: mode } }).catch((error) => console.error('Could not save preferences.json:', error));
  },

  setTheme: (theme: ThemeId) => {
    const current = get();
    const kind = themeColorScheme(theme);
    const selection = kind === 'dark'
      ? { ...current, darkThemeId: normalizeThemeId(theme, 'dark') }
      : { ...current, lightThemeId: normalizeThemeId(theme, 'light') };
    const mode: ThemeMode = kind;
    const resolved = resolveTheme(mode, selection);
    applyThemeToDocument(resolved);
    persistThemeMode(mode);
    persistThemeSelection(selection);
    set({ ...selection, themeMode: mode, theme: resolved });
    void preferencesJsonService.patch({ appearance: { themeMode: mode, darkThemeId: selection.darkThemeId, lightThemeId: selection.lightThemeId } }).catch((error) => console.error('Could not save preferences.json:', error));
  },

  toggleTheme: () => {
    const nextMode: ThemeMode = themeColorScheme(get().theme) === 'dark' ? 'light' : 'dark';
    get().setThemeMode(nextMode);
  },
}));

if (typeof window !== 'undefined' && window.matchMedia) {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handleMediaChange = () => {
    const { themeMode, setThemeMode } = useThemeStore.getState();
    if (themeMode === 'system') setThemeMode('system');
  };
  try { mediaQuery.addEventListener('change', handleMediaChange); }
  catch { mediaQuery.addListener(handleMediaChange); }
}

if (typeof window !== 'undefined') {
  window.addEventListener('stage0-preferences-updated', (event) => {
    const settings = (event as CustomEvent<Window['__STAGE0_PREFERENCES__']>).detail;
    const appearance = settings?.appearance;
    const current = useThemeStore.getState();
    const configuredMode = appearance?.themeMode;
    const mode = configuredMode === 'system' || configuredMode === 'dark' || configuredMode === 'light'
      ? configuredMode : current.themeMode;
    const selection = {
      darkThemeId: normalizeThemeId(appearance?.darkThemeId ?? current.darkThemeId, 'dark'),
      lightThemeId: normalizeThemeId(appearance?.lightThemeId ?? current.lightThemeId, 'light'),
    };
    const theme = resolveTheme(mode, selection);
    applyThemeToDocument(theme);
    persistThemeMode(mode);
    persistThemeSelection(selection);
    useThemeStore.setState({ ...selection, themeMode: mode, theme });
  });
}

export type { ThemeMode } from '../types/ThemeMode';
export type { ThemeId } from '../types/ThemeId';
export type { CatppuccinTheme } from '../types/CatppuccinTheme';
