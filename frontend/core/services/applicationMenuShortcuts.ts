import {
  APPLICATION_MENUS,
  MENU_COMMANDS,
  menuLabel,
  menuNodesForPlatform,
} from '../constants/applicationMenu';
import { formatShortcutText } from '../../common/utils/shortcuts';
import type { MenuNode } from '../types/menu/MenuNode';

export function matchesMenuShortcut(event: KeyboardEvent, shortcut: string, mac: boolean): boolean {
  const parts = shortcut.toLowerCase().split('+');
  const key = parts.pop()!;
  const primary = parts.includes('cmdorctrl');
  if (
    event.ctrlKey !== (parts.includes('ctrl') || (primary && !mac)) ||
    event.metaKey !== (parts.includes('cmd') || (primary && mac)) ||
    event.altKey !== parts.includes('alt') ||
    event.shiftKey !== parts.includes('shift')
  )
    return false;
  return (
    event.key.toLowerCase() === key ||
    event.code.toLowerCase() === `key${key}` ||
    event.code.toLowerCase() === `digit${key}` ||
    (key === '/' && event.code === 'Slash')
  );
}

export function menuActionForShortcut(event: KeyboardEvent, mac: boolean): string | undefined {
  return Object.entries(MENU_COMMANDS).find(
    ([, command]) =>
      // Native editing shortcuts stay with the text control/browser on Windows/Linux.
      !command.native && command.shortcut && matchesMenuShortcut(event, command.shortcut, mac)
  )?.[0];
}

export function getMenuShortcutCategories(platform: string, fileManager: string) {
  const collect = (nodes: MenuNode[]): { label: string; keys: string }[] =>
    menuNodesForPlatform(nodes, platform).flatMap((node) => {
      const command = node.command ? MENU_COMMANDS[node.command] : undefined;
      return command?.shortcut
        ? [
            {
              label: menuLabel(command.label, fileManager),
              keys: formatShortcutText(command.shortcut, platform === 'macos').replaceAll(
                'CmdOrCtrl',
                'Ctrl'
              ),
            },
          ]
        : collect(node.items || []);
    });
  return menuNodesForPlatform(APPLICATION_MENUS, platform)
    .map((node) => ({ title: node.label!, items: collect(node.items || []) }))
    .filter((category) => category.items.length > 0)
    .concat([
      {
        title: 'Workspace navigation',
        items: [
          { label: 'Close MR tab / draft', keys: platform === 'macos' ? '⌘ + W' : 'Ctrl+W' },
          { label: 'Switch MR tab', keys: 'Alt+1…9' },
          { label: 'Next / previous file', keys: 'Down / J · Up / K' },
          { label: 'Next conflict', keys: formatShortcutText('Alt+C', platform === 'macos') },
          { label: 'Split / unified diff', keys: 'S / U' },
        ],
      },
    ]);
}
