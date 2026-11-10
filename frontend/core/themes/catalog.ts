import mocha from '../../../themes/dark/catppuccin-mocha/theme.json';
import latte from '../../../themes/light/catppuccin-latte/theme.json';
import { ThemeRegistry } from './ThemeRegistry';
import type { ThemeDefinition } from './types/ThemeDefinition';

export const themeRegistry = new ThemeRegistry();
export const DEFAULT_THEMES = { dark: mocha.id, light: latte.id } as const;
const aliases: Record<string, string> = { mocha: mocha.id, 'mocha-light': latte.id, latte: latte.id,
  dark: mocha.id, light: latte.id, 'mocha-oled': mocha.id };
for (const definition of [mocha, latte]) themeRegistry.register(definition);

export function getTheme(id: string): ThemeDefinition {
  return themeRegistry.get(Object.hasOwn(aliases, id) ? aliases[id] : id) ?? themeRegistry.get(DEFAULT_THEMES.dark)!;
}
export function themeColorScheme(id: string): ThemeDefinition['kind'] { return getTheme(id).kind; }
export function resolvedThemeId(id: string): string {
  const definition = getTheme(id);
  return definition.id === mocha.id ? 'mocha' : definition.id === latte.id ? 'mocha-light' : definition.id;
}
export function themeDisplayName(id: string, translate: (key: string) => string): string {
  const definition = getTheme(id);
  return definition.id === mocha.id ? translate('common.layout.mochaDark')
    : definition.id === latte.id ? translate('common.layout.mochaLight') : definition.name;
}
