import properties from '../../../themes/color-tokens.json';
import { getTheme } from './catalog';

/** Apply an already validated record, clearing only the engine-owned token set. */
export function applyRegisteredTheme(id: string): void {
  if (typeof document === 'undefined') return;
  const theme = getTheme(id);
  const root = document.documentElement;
  root.setAttribute('data-theme', id === 'mocha' || id === 'mocha-light' ? id : theme.id);
  root.setAttribute('data-theme-id', theme.id);
  root.setAttribute('data-color-scheme', theme.kind);
  root.classList.remove('mocha', 'mocha-light', 'mocha-oled', 'latte', 'light', 'dark');
  root.classList.add(theme.kind);
  if (theme.kind === 'light') root.classList.add('mocha-light', 'latte');
  else root.classList.add('mocha');
  root.style.colorScheme = theme.kind;
  for (const property of Object.values(properties)) root.style.removeProperty?.(property);
  for (const [key, value] of Object.entries(theme.colors)) {
    root.style.setProperty(properties[key as keyof typeof properties], value);
  }
  if (document.body) {
    document.body.style.backgroundColor = 'var(--theme-crust)';
    document.body.style.color = 'var(--theme-text)';
  }
}
