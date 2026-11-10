import { expect, it } from 'vitest';
import { ThemeRegistry, validateTheme, applyRegisteredTheme, themeRegistry, themeColorScheme, BUILT_IN_THEMES } from './index';

it('registers the requested dark palettes alongside the existing defaults', () => {
  expect(BUILT_IN_THEMES.map(theme => theme.id)).toEqual([
    'catppuccin-mocha', 'catppuccin-latte', 'dracula', 'one-dark-pro', 'gruvbox', 'monokai',
  ]);
  expect(themeRegistry.list('dark').map(theme => theme.id)).toContain('dracula');
  expect(themeRegistry.list('dark').map(theme => theme.id)).toContain('one-dark-pro');
  expect(themeRegistry.list('dark').map(theme => theme.id)).toContain('gruvbox');
  expect(themeRegistry.list('dark').map(theme => theme.id)).toContain('monokai');
});

it('classifies future theme ids independently of Catppuccin names and rejects unsafe packages before mutation', () => {
  const registry = new ThemeRegistry();
  registry.register({ schemaVersion: 1, id: 'ocean-night', name: 'Ocean Night', kind: 'dark', version: '1.0.0', colors: { base: '#123456' } });
  const before = registry.getSnapshot();
  expect(() => registry.register({ schemaVersion: 1, id: 'unsafe', name: 'Unsafe', kind: 'dark', version: '1.0.0', colors: { base: 'url(https://bad.example)' } })).toThrow();
  expect(registry.getSnapshot()).toBe(before);
  expect(() => validateTheme({ ...before[0], css: 'body { display:none }' })).toThrow();
  themeRegistry.register({ ...before[0], id: 'react-ocean-night' });
  expect(themeColorScheme('react-ocean-night')).toBe('dark');
  applyRegisteredTheme('react-ocean-night');
  expect(document.documentElement).toHaveAttribute('data-theme-id', 'react-ocean-night');
  expect(document.documentElement.style.getPropertyValue('--theme-base')).toBe('#123456');
  applyRegisteredTheme('mocha-light');
  expect(document.documentElement.style.getPropertyValue('--theme-base')).toBe('#eff1f5');
  expect(document.documentElement).toHaveAttribute('data-color-scheme', 'light');
  applyRegisteredTheme('mocha');
});
