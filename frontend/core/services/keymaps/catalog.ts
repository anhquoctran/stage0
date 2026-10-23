import config from '../../../../shared/keymaps.json';
import { APPLICATION_MENUS, MENU_COMMANDS, menuNodesForPlatform } from '../../constants/applicationMenu';
import type { MenuNode } from '../../types/menu/MenuNode';
import type { KeymapCommand } from '../../types/keymaps/KeymapCommand';
import type { KeymapSettings } from '../../types/keymaps/KeymapSettings';

export const KEYMAP_PRESETS = config.presets;
export const DEFAULT_KEYMAP: KeymapSettings = { preset: 'stage0', overrides: [] };
export function keymapPlatform(): string {
  if (typeof navigator === 'undefined') return 'linux';
  const platform = navigator.platform || navigator.userAgent;
  return /Mac|iPod|iPhone|iPad/.test(platform) ? 'macos' : /Win/i.test(platform) ? 'windows' : 'linux';
}

export function keymapCatalog(platform = keymapPlatform()): KeymapCommand[] {
  const visible = new Set<string>();
  const visit = (nodes: MenuNode[]) => menuNodesForPlatform(nodes, platform).forEach((node) => {
    if (node.command) visible.add(node.command);
    visit(node.items ?? []);
  });
  visit(APPLICATION_MENUS);
  const defaults = config.defaults as Record<string, string[]>;
  const system = config.system as Record<string, string[]>;
  return [
    ...Object.entries(MENU_COMMANDS).filter(([id]) => visible.has(id)).map(([id, command]) => ({
      id, label: command.label.replace('{fileManager}', 'File Manager'),
      scope: (command.requires?.includes('repository') || command.requires?.includes('file') || command.requires?.includes('textFile') ? 'workspace' : 'application') as KeymapCommand['scope'],
      keys: defaults[id] ?? (command.shortcut ? [command.shortcut] : system[id] ?? []),
      editable: !command.native && id !== 'exit', requires: command.requires ?? [],
      repeatable: config.repeatable.includes(id),
    })),
    ...Object.entries(config.commands).map(([id, command]) => ({
      id, label: command.label, scope: command.scope as KeymapCommand['scope'],
      keys: command.keys, editable: true, requires: [],
      repeatable: config.repeatable.includes(id),
    })),
  ];
}

export function resolveKeymap(settings: KeymapSettings = DEFAULT_KEYMAP, platform = keymapPlatform()): KeymapCommand[] {
  const preset = KEYMAP_PRESETS.find((item) => item.id === settings.preset) ?? KEYMAP_PRESETS[0];
  const platformBindings = (preset.platforms as Record<string, Record<string, string[]>>)[platform] ?? {};
  const bindings = { ...preset.bindings, ...platformBindings } as Record<string, string[]>;
  const overrides = new Map(settings.overrides.map((item) => [item.command, item.keys]));
  return keymapCatalog(platform).map((command) => ({
    ...command,
    keys: command.editable ? overrides.get(command.id) ?? bindings[command.id] ?? command.keys : command.keys,
  }));
}
