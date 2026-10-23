import { DEFAULT_KEYMAP, KEYMAP_PRESETS, keymapCatalog, resolveKeymap } from './catalog';
import { normalizeShortcut } from './keystroke';
import type { KeymapSettings } from '../../types/keymaps/KeymapSettings';
import type { KeymapCommand } from '../../types/keymaps/KeymapCommand';

function overlaps(a: KeymapCommand, b: KeymapCommand): boolean {
  return !(a.scope === 'welcome' && ['workspace', 'tabs'].includes(b.scope)) &&
    !(b.scope === 'welcome' && ['workspace', 'tabs'].includes(a.scope));
}
export function keymapErrors(settings: KeymapSettings, platform: string): string[] {
  const errors: string[] = [];
  if (!KEYMAP_PRESETS.some((item) => item.id === settings?.preset)) return ['Choose a supported keymap preset.'];
  if (Object.keys(settings).some((key) => !['preset', 'overrides'].includes(key))) errors.push('Unknown keymap property.');
  if (!Array.isArray(settings.overrides) || settings.overrides.length > 256) return ['Keymap overrides must be an array of at most 256 entries.'];
  const known = new Map([...keymapCatalog('macos'), ...keymapCatalog('windows'), ...keymapCatalog('linux')].map((item) => [item.id, item]));
  const seen = new Set<string>();
  for (const item of settings.overrides) {
    if (!item || typeof item !== 'object' || Object.keys(item).some((key) => !['command', 'keys'].includes(key))) errors.push('Unknown keymap override property.');
    const command = known.get(item?.command);
    if (!command?.editable) errors.push(`Unknown or system-managed command: ${item?.command}.`);
    if (seen.has(item?.command)) errors.push(`Duplicate override for ${item.command}.`);
    seen.add(item?.command);
    if (!Array.isArray(item?.keys) || item.keys.length > 4 || item.keys.some((key) => typeof key !== 'string')) {
      errors.push(`${item?.command}: use up to four shortcuts, or an empty array to unbind.`);
      continue;
    }
    for (const key of item.keys) {
      try { normalizeShortcut(key); } catch (error) { errors.push(`${item.command}: ${(error as Error).message}`); }
    }
  }
  if (errors.length) return errors;
  const mac = platform === 'macos';
  const entries = resolveKeymap(settings, platform).flatMap((command) => command.keys.map((key) => ({ command, key: normalizeShortcut(key, mac) })));
  for (const [index, entry] of entries.entries()) {
    if (entry.command.editable && entry.key.split(' ').some((stroke) => /^(?:Shift\+)?(?:Escape|Tab)$/.test(stroke)))
      errors.push(`${entry.command.label}: Escape and Tab are reserved for cancel and focus navigation.`);
    for (const other of entries.slice(0, index)) {
      if (!overlaps(entry.command, other.command)) continue;
      if (entry.key === other.key || entry.key.startsWith(`${other.key} `) || other.key.startsWith(`${entry.key} `))
        errors.push(`${entry.key}: ${entry.command.label} conflicts with ${other.command.label}.`);
    }
  }
  return [...new Set(errors)];
}
export function readKeymap(value: unknown): KeymapSettings {
  if (!value || typeof value !== 'object') return structuredClone(DEFAULT_KEYMAP);
  const settings = value as KeymapSettings;
  // Valid persisted files are checked natively. Web/legacy bootstrap fails closed.
  try {
    if (['macos', 'windows', 'linux'].some((platform) => keymapErrors(settings, platform).length)) return structuredClone(DEFAULT_KEYMAP);
    return structuredClone(settings);
  } catch { return structuredClone(DEFAULT_KEYMAP); }
}
