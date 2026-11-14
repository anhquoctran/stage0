import { afterEach, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { applyRegisteredTheme, themeRegistry } from './index';
import '../../../themes/index.css';
import '../styles/index.css';

afterEach(() => applyRegisteredTheme('mocha'));

it('keeps representative legacy palette and splash colors after CSS extraction', () => {
  const legacyValues = {
    dark: { id: 'mocha', values: { '--theme-crust': '#11111b', '--theme-base': '#1e1e2e', '--theme-brand': '#9333ea', '--splash-bg': '#11111b', '--splash-title-accent': '#89b4fa', '--syntax-keyword': '#cba6f7' } },
    light: { id: 'mocha-light', values: { '--theme-crust': '#dce0e8', '--theme-base': '#eff1f5', '--theme-brand': '#9333ea', '--splash-bg': '#dce0e8', '--splash-title-accent': '#1e66f5', '--syntax-keyword': '#8839ef' } },
  } as const;
  for (const [kind, { id, values }] of Object.entries(legacyValues)) {
    applyRegisteredTheme(id);
    const computed = getComputedStyle(document.documentElement);
    for (const [key, value] of Object.entries(values)) {
      expect(computed.getPropertyValue(key).trim().replace(/\s+/g, ' '), `${kind} ${key}`)
        .toBe(value);
    }
    expect(computed.colorScheme).toBe(kind);
  }
});

it('applies a data-only Light theme across controls and viewer subtrees, then clears overrides', () => {
  themeRegistry.register({ schemaVersion: 1, id: 'browser-ocean-day', name: 'Ocean Day', kind: 'light',
    version: '1.0.0', colors: { base: '#f7fbff', text: '#122334', brand: '#0055aa', 'interactive-input-bg': '#ffffff', 'syntax-keyword': '#003366' } });
  document.documentElement.style.setProperty('--viewer-font-size', '17px');
  document.documentElement.setAttribute('data-ui-density', 'compact');
  render(<div>
    <input aria-label="Editable value" className="bg-surface0 text-text p-2" />
    <div data-theme="light" className="bg-base syntax-highlight" data-testid="viewer"><span className="hljs-keyword" data-testid="keyword">const</span></div>
  </div>);
  applyRegisteredTheme('browser-ocean-day');
  expect(document.documentElement).toHaveAttribute('data-color-scheme', 'light');
  expect(getComputedStyle(screen.getByRole('textbox')).backgroundColor).toBe('rgb(255, 255, 255)');
  expect(getComputedStyle(screen.getByTestId('viewer')).backgroundColor).toBe('rgb(247, 251, 255)');
  expect(getComputedStyle(document.documentElement).getPropertyValue('--color-brand').trim()).toBe('#0055aa');
  expect(getComputedStyle(screen.getByTestId('keyword')).color).toBe('rgb(0, 51, 102)');
  applyRegisteredTheme('mocha');
  expect(getComputedStyle(screen.getByTestId('keyword')).color).toBe('rgb(203, 166, 247)');
  expect(document.documentElement.style.getPropertyValue('--theme-brand')).toBe('');
  expect(getComputedStyle(screen.getByTestId('viewer')).backgroundColor).toBe('rgb(30, 30, 46)');
  expect(document.documentElement.style.getPropertyValue('--viewer-font-size')).toBe('17px');
  expect(document.documentElement).toHaveAttribute('data-ui-density', 'compact');
  document.documentElement.style.removeProperty('--viewer-font-size');
  document.documentElement.removeAttribute('data-ui-density');
});
