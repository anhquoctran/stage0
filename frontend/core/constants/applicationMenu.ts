import config from '../../../shared/application-menu.json';
import type { MenuCommand } from '../types/menu/MenuCommand';
import type { MenuNode } from '../types/menu/MenuNode';

export const MENU_COMMANDS: Record<string, MenuCommand> = config.commands;
export const APPLICATION_MENUS: MenuNode[] = config.menus;
export const RECENT_MENU = config.recent;
export type MenuActionId = keyof typeof config.commands;

export function menuNodesForPlatform(nodes: MenuNode[], platform: string): MenuNode[] {
  const visible = nodes.filter((node) => !node.platforms || node.platforms.includes(platform));
  return visible.filter(
    (node, index) =>
      !node.separator || (index > 0 && index < visible.length - 1 && !visible[index - 1].separator)
  );
}

export function menuLabel(label: string, fileManager: string): string {
  return label.replace('{fileManager}', fileManager);
}

export function menuEnabled(requires: string[] | undefined, flags: object): boolean {
  return (requires || []).every((key) => (flags as Record<string, boolean>)[key] === true);
}

export function menuShortcut(id: string): string | undefined {
  return MENU_COMMANDS[id]?.shortcut;
}
