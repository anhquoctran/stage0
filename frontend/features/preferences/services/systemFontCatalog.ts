import { invoke, isTauri } from '../../../common/services/ipc/ipcClient';
import {
  BUNDLED_UI_FONT_FAMILIES,
  LOW_PRIORITY_UI_FONT_FAMILIES,
  RECOMMENDED_UI_FONT_FAMILIES,
} from '../constants/uiFonts';

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
  const families = normalizeFontFamilies([...BUNDLED_UI_FONT_FAMILIES, ...installed]);
  const recommended = new Map(RECOMMENDED_UI_FONT_FAMILIES.map((family, index) => [family.toLowerCase(), index]));
  const lowPriority = new Map(LOW_PRIORITY_UI_FONT_FAMILIES.map((family, index) => [family.toLowerCase(), index]));
  return families.sort((left, right) => {
    const leftRecommended = recommended.get(left.toLowerCase());
    const rightRecommended = recommended.get(right.toLowerCase());
    if (leftRecommended !== undefined || rightRecommended !== undefined) {
      if (leftRecommended === undefined) return 1;
      if (rightRecommended === undefined) return -1;
      return leftRecommended - rightRecommended;
    }

    const leftLowPriority = lowPriority.get(left.toLowerCase());
    const rightLowPriority = lowPriority.get(right.toLowerCase());
    if (leftLowPriority !== undefined || rightLowPriority !== undefined) {
      if (leftLowPriority === undefined) return -1;
      if (rightLowPriority === undefined) return 1;
      return leftLowPriority - rightLowPriority;
    }
    return left.localeCompare(right);
  });
}

export function browserFontDiscoveryAvailable(): boolean {
  return typeof window !== 'undefined' && 'queryLocalFonts' in window;
}

export function loadSystemFontFamilies(requestBrowserAccess = false): Promise<string[]> {
  if (pending) return pending;
  const read = async () => {
    let names: string[];
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
