/** Public theme boundary; installer persistence/UI will compose this API later. */
export { ThemeRegistry } from './ThemeRegistry';
export { validateTheme, parseThemePackage } from './validateTheme';
export { themeRegistry, getTheme, themeColorScheme, DEFAULT_THEMES } from './catalog';
export { applyRegisteredTheme } from './applyTheme';
export type { ThemeDefinition } from './types/ThemeDefinition';
