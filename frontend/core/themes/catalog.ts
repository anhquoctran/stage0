import mocha from '../../../themes/dark/catppuccin-mocha/theme.json';
import latte from '../../../themes/light/catppuccin-latte/theme.json';
import dracula from '../../../themes/dark/dracula/theme.json';
import oneDarkPro from '../../../themes/dark/one-dark-pro/theme.json';
import gruvbox from '../../../themes/dark/gruvbox/theme.json';
import monokai from '../../../themes/dark/monokai/theme.json';
import alucard from '../../../themes/light/alucard/theme.json';
import atomOneLight from '../../../themes/light/atom-one-light/theme.json';
import gruvboxLight from '../../../themes/light/gruvbox-light/theme.json';
import { ThemeRegistry } from './ThemeRegistry';
import type { ThemeDefinition } from './types/ThemeDefinition';

export const themeRegistry = new ThemeRegistry();
export const DEFAULT_THEMES = { dark: mocha.id, light: latte.id } as const;
export const BUILT_IN_THEMES = [mocha, latte, dracula, oneDarkPro, gruvbox, monokai, alucard, atomOneLight, gruvboxLight] as const;
const aliases: Record<string, string> = { mocha: mocha.id, 'mocha-light': latte.id, latte: latte.id,
  dark: mocha.id, light: latte.id, 'mocha-oled': mocha.id };
for (const definition of BUILT_IN_THEMES) themeRegistry.register(definition);

export function normalizeThemeId(id: unknown, kind: ThemeDefinition['kind']): string {
  const theme = typeof id === 'string'
    ? themeRegistry.get(Object.hasOwn(aliases, id) ? aliases[id] : id)
    : undefined;
  return theme?.kind === kind ? theme.id : DEFAULT_THEMES[kind];
}

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
