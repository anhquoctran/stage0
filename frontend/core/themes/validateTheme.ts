import properties from '../../../themes/color-tokens.json';
import type { ThemeDefinition } from './types/ThemeDefinition';

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value));
}

/** V1 packages contain color data only: never selectors, URLs, scripts or fonts. */
export function validateTheme(input: unknown): ThemeDefinition {
  if (!object(input)) throw new Error('Theme must be a plain object');
  const fields = ['schemaVersion', 'id', 'name', 'kind', 'version', 'author', 'colors'];
  if (Object.keys(input).some(key => !fields.includes(key))) throw new Error('Unknown theme field');
  if (input.schemaVersion !== 1) throw new Error('Unsupported theme schema version');
  if (typeof input.id !== 'string' || input.id.length > 64 || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(input.id))
    throw new Error('Invalid theme id');
  if (['mocha', 'mocha-light', 'latte', 'dark', 'light', 'system'].includes(input.id)) throw new Error('Reserved theme id');
  for (const [key, limit] of [['name', 80], ['version', 32], ['author', 120]] as const) {
    const value = input[key];
    if (key === 'author' && value === undefined) continue;
    if (typeof value !== 'string' || !value.trim() || value.length > limit || /[\x00-\x1f<>]/.test(value))
      throw new Error(`Invalid theme ${key}`);
  }
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(input.version as string)) throw new Error('Invalid theme version');
  if (input.kind !== 'dark' && input.kind !== 'light') throw new Error('Theme kind must be dark or light');
  if (!object(input.colors)) throw new Error('Theme colors must be a plain object');
  const colors: Record<string, string> = {};
  for (const [key, value] of Object.entries(input.colors)) {
    if (!Object.hasOwn(properties, key)) throw new Error(`Unknown color token: ${key}`);
    if (typeof value !== 'string' || !isThemeColor(value)) throw new Error(`Invalid color token: ${key}`);
    colors[key] = value;
  }
  return Object.freeze({ schemaVersion: 1, id: input.id, name: input.name as string,
    kind: input.kind, version: input.version as string,
    ...(input.author === undefined ? {} : { author: input.author as string }), colors: Object.freeze(colors) });
}

export function isThemeColor(value: string): boolean {
  if (value.length > 64) return false;
  if (/^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(value)) return true;
  const match = /^(rgb|rgba)\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(0(?:\.\d+)?|1(?:\.0+)?))?\s*\)$/.exec(value);
  return !!match && match.slice(2, 5).every(part => Number(part) <= 255)
    && ((match[1] === 'rgba') === (match[5] !== undefined)) && value.length <= 64;
}

/** The future installer can preflight bounded JSON before touching disk/state. */
export function parseThemePackage(text: string): ThemeDefinition {
  if (text.length > 32768 || new TextEncoder().encode(text).byteLength > 32768)
    throw new Error('Theme package exceeds 32 KiB');
  return validateTheme(JSON.parse(text));
}
