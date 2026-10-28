import {
  APPLICATION_MENUS,
  MENU_COMMANDS,
  menuLabel,
  menuNodesForPlatform,
} from '../constants/applicationMenu';
import type { MenuNode } from '../types/menu/MenuNode';
import { DEFAULT_KEYMAP, resolveKeymap } from './keymaps/catalog';
import { eventStroke, normalizeShortcut, formatKeybinding } from './keymaps/keystroke';
import type { KeymapSettings } from '../types/keymaps/KeymapSettings';

export function matchesMenuShortcut(event: KeyboardEvent, shortcut: string, mac: boolean): boolean {
  try { return eventStroke(event, mac) === normalizeShortcut(shortcut, mac); }
  catch { return false; }
}

export function menuActionForShortcut(event: KeyboardEvent, mac: boolean, settings = DEFAULT_KEYMAP): string | undefined {
  return resolveKeymap(settings, mac ? 'macos' : 'windows').find(
    (command) =>
      // Native editing shortcuts stay with the text control/browser on Windows/Linux.
      command.editable && Object.hasOwn(MENU_COMMANDS, command.id) && command.keys.some((key) => matchesMenuShortcut(event, key, mac))
  )?.id;
}

export function getMenuShortcutCategories(
  platform: string,
  fileManager: string,
  settings: KeymapSettings = DEFAULT_KEYMAP,
  translate: (key: string) => string = (key) => key,
) {
  const resolved = resolveKeymap(settings, platform);
  const keys = (id: string) => resolved.find((command) => command.id === id)?.keys.map((key) => formatKeybinding(key, platform === 'macos')).join(' / ');
  const collect = (nodes: MenuNode[]): { label: string; keys: string }[] =>
    menuNodesForPlatform(nodes, platform).flatMap((node) => {
      const command = node.command ? MENU_COMMANDS[node.command] : undefined;
      return command && node.command && keys(node.command)
        ? [
            {
              label: menuLabel(translate(command.label), fileManager),
              keys: keys(node.command)!,
            },
          ]
        : collect(node.items || []);
    });
  return menuNodesForPlatform(APPLICATION_MENUS, platform)
    .map((node) => ({ title: translate(node.label!), items: collect(node.items || []) }))
    .filter((category) => category.items.length > 0)
    .concat([
      {
        title: translate('menu.categories.workspace'),
        items: resolved.filter((command) => !Object.hasOwn(MENU_COMMANDS, command.id) && command.keys.length).map((command) => ({ label: command.label, keys: keys(command.id)! })),
      },
    ]);
}
