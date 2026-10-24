import { invoke, isTauri } from '@tauri-apps/api/core';
import { BUNDLED_UI_FONT_FAMILIES } from '../constants/uiFonts';

let installed: string[] = [];
let pending: Promise<string[]> | null = null;

export function normalizeFontFamilies(names: unknown): string[] {
  if (!Array.isArray(names)) throw new Error('System font discovery returned an invalid list.');
  const unique = new Map<string, string>();
  for (const name of names) {
    if (typeof name !== 'string') continue;
    const family = name.trim();
    if (!family || family.startsWith('.') || new TextEncoder().encode(family).length > 128 || /[\u0000-\u001f\u007f]/.test(family)) continue;
    const key = family.toLowerCase();
    if (!unique.has(key)) unique.set(key, family);
  }
  return [...unique.values()].sort((left, right) => left.localeCompare(right));
}

export function availableUiFontFamilies(): string[] {
  return normalizeFontFamilies([...BUNDLED_UI_FONT_FAMILIES, ...installed]);
}

export function browserFontDiscoveryAvailable(): boolean {
  return typeof window !== 'undefined' && 'queryLocalFonts' in window;
}

export function loadSystemFontFamilies(requestBrowserAccess = false): Promise<string[]> {
  if (pending) return pending;
  const read = async () => {
    let names: unknown;
    if (isTauri()) {
      names = await invoke<string[]>('list_system_font_families');
    } else {
      // Local Font Access requires permission and a user gesture. Never prompt
      // on render or fabricate a browser list with document.fonts.check().
      if (!requestBrowserAccess) return availableUiFontFamilies();
      const browser = window as Window & { queryLocalFonts?: () => Promise<Array<{ family: string }>> };
      if (!browser.queryLocalFonts) throw new Error('System font discovery requires the desktop app or a browser with Local Font Access.');
      names = (await browser.queryLocalFonts()).map((font) => font.family);
    }
    installed = normalizeFontFamilies(names);
    return availableUiFontFamilies();
  };
  pending = read().finally(() => { pending = null; });
  return pending;
}
